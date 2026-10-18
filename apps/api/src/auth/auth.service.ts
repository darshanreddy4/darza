import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { AuthTokenType } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { MailService } from "../mail/mail.service";
import { resetPasswordMail, verifyEmailMail } from "../mail/templates";
import { PrismaService } from "../prisma.service";
import { SmsService } from "../sms/sms.service";
import { ChangePasswordDto, LoginDto, RegisterDto, SendOtpDto, VerifyOtpDto } from "./auth.dto";
import { verifyGoogleIdToken } from "./google";
import { OTP_MAX_ATTEMPTS, OTP_MAX_PER_HOUR, OTP_RESEND_MS, OTP_TTL_MS, checkOtp, hashOtp, newOtp, otpMatches } from "./otp";
import { passwordProblem } from "./password-rules";
import { normalisePhone } from "./phone";
import { SiteService } from "../site/site.module";
import { afterFailedLogin, lockMinutesLeft } from "./lockout";
import { hashToken, newToken } from "./tokens";

const HOUR = 3_600_000;
const jwtSecret = () => process.env.JWT_SECRET ?? "";
const INVALID_LINK = "This link is invalid or has expired. Please request a new one.";

interface UserRow { id: string; email: string | null; phone: string | null; name: string; role: "CUSTOMER" | "STAFF" | "ADMIN"; emailVerifiedAt: Date | null; phoneVerifiedAt: Date | null; tokenVersion: number; passwordSet: boolean; googleId: string | null }

// "verified" is what orders and reviews need: a confirmed email address or a confirmed phone number.
export const publicUser = (u: UserRow) => ({
  id: u.id, email: u.email, phone: u.phone, name: u.name, role: u.role,
  emailVerified: !!u.emailVerifiedAt, verified: !!(u.emailVerifiedAt || u.phoneVerifiedAt),
  // What the account page offers: phone-only and Google accounts have no password until they set one.
  hasPassword: u.passwordSet && !!u.email, googleLinked: !!u.googleId,
});

// The ways someone can prove who they are before something irreversible, such as deleting the account.
export interface IdentityProof { password?: string; code?: string; googleCredential?: string }

const randomPasswordHash = () => bcrypt.hash(randomBytes(32).toString("hex"), 10);

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService, private mail: MailService, private site: SiteService, private sms: SmsService) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    const problem = passwordProblem(dto.password, { email, name: dto.name });
    if (problem) throw new BadRequestException(problem);
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException("Email already registered");
    const user = await this.prisma.user.create({
      data: { email, name: dto.name.trim(), passwordHash: await bcrypt.hash(dto.password, 12), termsAcceptedAt: new Date() },
    });
    await this.sendVerification(user.id, email, user.name);
    return this.session(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    const left = user ? lockMinutesLeft(user.lockedUntil) : 0;
    if (left > 0) throw new HttpException(`Too many wrong passwords. Try again in ${left} ${left === 1 ? "minute" : "minutes"}, or reset your password.`, HttpStatus.TOO_MANY_REQUESTS);
    const ok = user && (await bcrypt.compare(dto.password, user.passwordHash));
    if (!user || !ok) {
      if (user) {
        const { failedLogins } = await this.prisma.user.update({ where: { id: user.id }, data: { failedLogins: { increment: 1 } }, select: { failedLogins: true } });
        const next = afterFailedLogin(failedLogins);
        if (next.lockedUntil) await this.prisma.user.update({ where: { id: user.id }, data: next });
      }
      throw new UnauthorizedException("Invalid credentials");
    }
    if (user.failedLogins > 0 || user.lockedUntil) await this.prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
    return this.session(user);
  }

  // What the sign-in screens can offer: Google needs GOOGLE_CLIENT_ID; phone needs a way to send text messages.
  providers() {
    return { google: process.env.GOOGLE_CLIENT_ID ? { clientId: process.env.GOOGLE_CLIENT_ID } : null, phone: this.sms.available };
  }

  async sendOtp(dto: SendOtpDto) {
    const phone = normalisePhone(dto.phone);
    if (!phone) throw new BadRequestException("Enter a valid mobile number");
    if (!this.sms.available) throw new ServiceUnavailableException("Phone sign-in is not available right now. Please use email instead.");

    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (dto.purpose === "signup" && existing) throw new ConflictException("This number already has an account. Please log in instead.");
    // Same answer whether or not the number has an account, so this cannot be used to look people up.
    if (dto.purpose === "login" && !existing) return { ok: true, resendInSeconds: OTP_RESEND_MS / 1000, ...(process.env.OTP_DEBUG_RESPONSE ? { devNote: "No account uses this number, so no code was sent. Use Create an account to sign up with it." } : {}) };
    return this.issueOtp(phone, dto.purpose);
  }

  // Applies the resend and hourly limits, then texts a fresh code. Any older unused code stops working.
  private async issueOtp(phone: string, purpose: string) {
    const now = Date.now();
    const [last, lastHour] = await Promise.all([
      this.prisma.otpCode.findFirst({ where: { phone }, orderBy: { createdAt: "desc" } }),
      this.prisma.otpCode.count({ where: { phone, createdAt: { gt: new Date(now - HOUR) } } }),
    ]);
    if (last && now - last.createdAt.getTime() < OTP_RESEND_MS) throw new HttpException("Please wait a few seconds before asking for another code", HttpStatus.TOO_MANY_REQUESTS);
    if (lastHour >= OTP_MAX_PER_HOUR) throw new HttpException("Too many codes were requested for this number. Please try again in an hour.", HttpStatus.TOO_MANY_REQUESTS);

    const resendInSeconds = OTP_RESEND_MS / 1000;
    const code = newOtp();
    // Older unused codes are retired, not deleted, so the hourly count above sees every code that was sent.
    await this.prisma.otpCode.updateMany({ where: { phone, consumedAt: null }, data: { consumedAt: new Date() } });
    await this.prisma.otpCode.create({ data: { phone, purpose, codeHash: hashOtp(phone, code, jwtSecret()), expiresAt: new Date(now + OTP_TTL_MS) } });
    await this.sms.send(phone, `${await this.site.brandName()}: ${code} is your verification code. It expires in 10 minutes. Never share it with anyone.`);
    // Only for automated tests; refused when the API starts in production.
    return { ok: true, resendInSeconds, ...(process.env.OTP_DEBUG_RESPONSE ? { devCode: code } : {}) };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const phone = normalisePhone(dto.phone);
    if (!phone) throw new BadRequestException("Enter a valid mobile number");
    await this.consumeOtp(phone, dto.purpose, dto.code);

    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (dto.purpose === "login") {
      if (!existing) throw new BadRequestException("We could not find an account for this number. Please sign up first.");
      return this.session(existing);
    }

    if (existing) throw new ConflictException("This number already has an account. Please log in instead.");
    if (!dto.name?.trim()) throw new BadRequestException("Please tell us your name");
    if (dto.termsAccepted !== true) throw new BadRequestException("Please accept the Terms & Conditions and Privacy Policy");
    const user = await this.prisma.user.create({
      data: { phone, phoneVerifiedAt: new Date(), name: dto.name.trim(), passwordHash: await randomPasswordHash(), passwordSet: false, termsAcceptedAt: new Date() },
    });
    return this.session(user);
  }

  // Checks the code for this number and purpose and uses it up; throws a customer-friendly error otherwise.
  private async consumeOtp(phone: string, purpose: string, code: string) {
    const row = await this.prisma.otpCode.findFirst({ where: { phone, purpose, consumedAt: null }, orderBy: { createdAt: "desc" } });
    if (!row) throw new BadRequestException("That code has expired. Please ask for a new one.");

    const state = checkOtp(row, otpMatches(phone, code, jwtSecret(), row.codeHash));
    if (state === "expired") throw new BadRequestException("That code has expired. Please ask for a new one.");
    if (state === "locked") throw new BadRequestException("Too many wrong attempts. Please ask for a new code.");
    if (state === "wrong") {
      await this.prisma.otpCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
      const left = OTP_MAX_ATTEMPTS - row.attempts - 1;
      throw new BadRequestException(left > 0 ? `That code is not right. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong attempts. Please ask for a new code.");
    }
    // One conditional update, so two requests cannot both use the same code.
    const { count } = await this.prisma.otpCode.updateMany({ where: { id: row.id, consumedAt: null }, data: { consumedAt: new Date() } });
    if (count !== 1) throw new BadRequestException("That code has expired. Please ask for a new one.");
  }

  // Signs in with a Google ID token. A matching email address is linked, because Google has confirmed it belongs to them.
  async googleSignIn(credential: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw new ServiceUnavailableException("Google sign-in is not available right now. Please use email instead.");
    const profile = await verifyGoogleIdToken(credential, clientId);
    if (!profile) throw new UnauthorizedException("We could not verify your Google sign-in. Please try again.");

    let user = await this.prisma.user.findUnique({ where: { googleId: profile.sub } });
    if (!user) {
      const sameEmail = await this.prisma.user.findUnique({ where: { email: profile.email } });
      user = sameEmail
        ? await this.prisma.user.update({ where: { id: sameEmail.id }, data: { googleId: profile.sub, emailVerifiedAt: sameEmail.emailVerifiedAt ?? new Date() } })
        : await this.prisma.user.create({
            data: { email: profile.email, googleId: profile.sub, name: profile.name, emailVerifiedAt: new Date(), passwordHash: await randomPasswordHash(), passwordSet: false, termsAcceptedAt: new Date() },
          });
    }
    return this.session(user);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return { user: publicUser(user) };
  }

  async resendVerification(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.email && !user.emailVerifiedAt) await this.sendVerification(user.id, user.email, user.name);
  }

  async verifyEmail(token: string) {
    const { userId, type, data } = await this.consume(token, ["EMAIL_VERIFY", "EMAIL_ADD"]);
    if (type === "EMAIL_VERIFY") {
      await this.prisma.user.updateMany({ where: { id: userId, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
      return;
    }
    // The address is only attached once its owner has clicked the link, so it is verified from the start.
    try {
      const { count } = await this.prisma.user.updateMany({ where: { id: userId, email: null, deletedAt: null }, data: { email: data, emailVerifiedAt: new Date() } });
      if (count !== 1) throw new BadRequestException("This account already has an email address.");
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") throw new ConflictException("That email address now belongs to another account.");
      throw e;
    }
  }

  // Starts adding an email address to an account that has none (phone-only accounts); it is saved once confirmed.
  async addEmail(userId: string, emailRaw: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (user.email) throw new BadRequestException("This account already has an email address.");
    const email = emailRaw.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException("That email address is already used by another account.");
    const token = await this.issueToken(userId, "EMAIL_ADD", 24 * HOUR, email);
    await this.mail.send({ to: email, ...verifyEmailMail(await this.site.brandName(), user.name, `${await this.site.webOrigin()}/verify-email?token=${token}`) });
  }

  // Texts a code to a new number so it can be added to the account.
  async sendPhoneLink(userId: string, phoneRaw: string) {
    const phone = await this.phoneToLink(userId, phoneRaw);
    if (!this.sms.available) throw new ServiceUnavailableException("Adding a phone number is not available right now.");
    return this.issueOtp(phone, "link");
  }

  async verifyPhoneLink(userId: string, phoneRaw: string, code: string) {
    const phone = await this.phoneToLink(userId, phoneRaw);
    await this.consumeOtp(phone, "link", code);
    try {
      const { count } = await this.prisma.user.updateMany({ where: { id: userId, phone: null }, data: { phone, phoneVerifiedAt: new Date() } });
      if (count !== 1) throw new BadRequestException("This account already has a phone number.");
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") throw new ConflictException("That number is already used by another account.");
      throw e;
    }
    return this.me(userId);
  }

  private async phoneToLink(userId: string, phoneRaw: string) {
    const phone = normalisePhone(phoneRaw);
    if (!phone) throw new BadRequestException("Enter a valid mobile number");
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (user.phone) throw new BadRequestException("This account already has a phone number.");
    if (await this.prisma.user.findUnique({ where: { phone } })) throw new ConflictException("That number is already used by another account.");
    return phone;
  }

  // Lets an account that signed up another way sign in with Google as well.
  async linkGoogle(userId: string, credential: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw new ServiceUnavailableException("Google sign-in is not available right now.");
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (user.googleId) throw new BadRequestException("A Google account is already linked.");
    const profile = await verifyGoogleIdToken(credential, clientId);
    if (!profile) throw new UnauthorizedException("We could not verify your Google sign-in. Please try again.");
    if (await this.prisma.user.findUnique({ where: { googleId: profile.sub } })) throw new ConflictException("That Google account is already linked to another account.");

    const data: { googleId: string; email?: string; emailVerifiedAt?: Date } = { googleId: profile.sub };
    if (!user.email) {
      if (await this.prisma.user.findUnique({ where: { email: profile.email } })) throw new ConflictException("That Google account's email address is already used by another account.");
      data.email = profile.email;
      data.emailVerifiedAt = new Date();
    } else if (user.email === profile.email && !user.emailVerifiedAt) {
      data.emailVerifiedAt = new Date();
    }
    await this.prisma.user.update({ where: { id: userId }, data });
    return this.me(userId);
  }

  // Sets a first password on an account made with a phone number or Google, so it can also sign in with email.
  async setPassword(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (user.passwordSet) throw new BadRequestException("This account already has a password. Use change password instead.");
    if (!user.email) throw new BadRequestException("Add an email address first; you sign in with it and your password.");
    const problem = passwordProblem(password, { email: user.email, name: user.name });
    if (problem) throw new BadRequestException(problem);
    const updated = await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(password, 12), passwordSet: true, tokenVersion: { increment: 1 } } });
    return this.session(updated);
  }

  // Texts a code to the account's own phone, as proof of identity for accounts with no password.
  async sendIdentityCode(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.phone) throw new BadRequestException("This account has no phone number to send a code to.");
    if (!this.sms.available) throw new ServiceUnavailableException("We cannot send a code right now. Please use your password or Google instead.");
    return this.issueOtp(user.phone, "identity");
  }

  // Throws unless the proof matches the account: its password, a code texted to its phone, or its Google account.
  async verifyIdentity(userId: string, proof: IdentityProof) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const fail = () => new BadRequestException("We could not confirm it is you. Check your password, code or Google account and try again.");
    if (proof.password) {
      if (!user.passwordSet || !(await bcrypt.compare(proof.password, user.passwordHash))) throw fail();
    } else if (proof.code) {
      if (!user.phone) throw fail();
      await this.consumeOtp(user.phone, "identity", proof.code);
    } else if (proof.googleCredential) {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const profile = clientId ? await verifyGoogleIdToken(proof.googleCredential, clientId) : null;
      if (!profile || profile.sub !== user.googleId) throw fail();
    } else {
      throw fail();
    }
  }

  // Always resolves the same way so the response never reveals whether an address has an account.
  async forgotPassword(emailRaw: string) {
    const user = await this.prisma.user.findUnique({ where: { email: emailRaw.toLowerCase() } });
    if (!user) return;
    const recent = await this.prisma.authToken.findFirst({ where: { userId: user.id, type: "PASSWORD_RESET", createdAt: { gt: new Date(Date.now() - 60_000) } } });
    if (recent) return;
    const token = await this.issueToken(user.id, "PASSWORD_RESET", HOUR);
    if (!user.email) return;
    await this.mail.send({ to: user.email, ...resetPasswordMail(await this.site.brandName(), user.name, `${await this.site.webOrigin()}/reset-password?token=${token}`) });
  }

  async resetPassword(token: string, password: string) {
    const problem = passwordProblem(password);
    if (problem) throw new BadRequestException(problem);
    const { userId } = await this.consume(token, ["PASSWORD_RESET"]);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(password, 12), passwordSet: true, failedLogins: 0, lockedUntil: null, tokenVersion: { increment: 1 } },
    });
    // Receiving the reset email proves the address is theirs.
    await this.prisma.user.updateMany({ where: { id: userId, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
    await this.prisma.authToken.deleteMany({ where: { userId, type: "PASSWORD_RESET" } });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (!user.passwordSet) throw new BadRequestException("You have not set a password yet. Set one first.");
    // 400 rather than 401 so the web app doesn't treat a typo as an expired session.
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) throw new BadRequestException("Your current password is incorrect");
    if (dto.currentPassword === dto.newPassword) throw new BadRequestException("Choose a password different from your current one");
    const problem = passwordProblem(dto.newPassword, { email: user.email });
    if (problem) throw new BadRequestException(problem);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(dto.newPassword, 12), tokenVersion: { increment: 1 } },
    });
    return this.session(updated);
  }

  private async sendVerification(userId: string, email: string, name: string) {
    const token = await this.issueToken(userId, "EMAIL_VERIFY", 24 * HOUR);
    await this.mail.send({ to: email, ...verifyEmailMail(await this.site.brandName(), name, `${await this.site.webOrigin()}/verify-email?token=${token}`) });
  }

  private async issueToken(userId: string, type: AuthTokenType, ttlMs: number, data?: string) {
    const { token, hash } = newToken();
    await this.prisma.authToken.deleteMany({ where: { userId, type, usedAt: null } });
    await this.prisma.authToken.create({ data: { userId, type, tokenHash: hash, data, expiresAt: new Date(Date.now() + ttlMs) } });
    return token;
  }

  // Marks the token used in a single conditional update so two requests can't both redeem it.
  private async consume(token: string, types: AuthTokenType[]) {
    const row = await this.prisma.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!row || !types.includes(row.type)) throw new BadRequestException(INVALID_LINK);
    const { count } = await this.prisma.authToken.updateMany({ where: { id: row.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
    if (count !== 1) throw new BadRequestException(INVALID_LINK);
    return { userId: row.userId, type: row.type, data: row.data ?? "" };
  }

  private async session(user: UserRow) {
    const token = await this.jwt.signAsync({ sub: user.id, role: user.role, tv: user.tokenVersion });
    return { token, user: publicUser(user) };
  }
}
