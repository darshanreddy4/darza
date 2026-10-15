import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { AllowAnonymous, AuthGuard, type JwtPayload } from "./auth.guard";
import { AddEmailDto, ChangePasswordDto, ForgotPasswordDto, GoogleDto, LoginDto, PhoneLinkDto, PhoneLinkVerifyDto, RegisterDto, ResetPasswordDto, SendOtpDto, SetPasswordDto, TokenDto, VerifyOtpDto } from "./auth.dto";
import { clearSessionCookie, setSessionCookie } from "./session-cookie";

const HOURLY = (limit: number) => ({ default: { ttl: 3_600_000, limit } });

@Controller("auth")
@Throttle({ default: { ttl: 60_000, limit: 10 } })
export class AuthController {
  constructor(private auth: AuthService) {}

  // The session token only ever travels in an httpOnly cookie; the response body carries the profile.
  @Post("register")
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.auth.register(dto);
    setSessionCookie(res, token);
    return { user };
  }

  @Post("login")
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.auth.login(dto);
    setSessionCookie(res, token);
    return { user };
  }

  @Get("providers")
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  providers() {
    return this.auth.providers();
  }

  @Post("otp/send")
  @Throttle(HOURLY(20))
  sendOtp(@Body() dto: SendOtpDto) {
    return this.auth.sendOtp(dto);
  }

  @Post("otp/verify")
  @Throttle(HOURLY(30))
  async verifyOtp(@Body() dto: VerifyOtpDto, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.auth.verifyOtp(dto);
    setSessionCookie(res, token);
    return { user };
  }

  @Post("google")
  @Throttle(HOURLY(30))
  async google(@Body() dto: GoogleDto, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.auth.googleSignIn(dto.credential);
    setSessionCookie(res, token);
    return { user };
  }

  @Post("logout")
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    clearSessionCookie(res);
  }

  @Get("me")
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @UseGuards(AuthGuard)
  @AllowAnonymous()
  me(@Req() req: Request & { user?: JwtPayload }) {
    // Signed-out visitors get an ordinary answer, so the browser console stays free of 401 errors.
    return req.user ? this.auth.me(req.user.sub) : { user: null };
  }

  @Post("verify-email")
  @HttpCode(204)
  @Throttle(HOURLY(20))
  async verifyEmail(@Body() dto: TokenDto) {
    await this.auth.verifyEmail(dto.token);
  }

  @Post("resend-verification")
  @HttpCode(204)
  @Throttle(HOURLY(5))
  @UseGuards(AuthGuard)
  async resendVerification(@Req() req: Request & { user: JwtPayload }) {
    await this.auth.resendVerification(req.user.sub);
  }

  @Post("forgot-password")
  @HttpCode(204)
  @Throttle(HOURLY(5))
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgotPassword(dto.email);
  }

  @Post("reset-password")
  @HttpCode(204)
  @Throttle(HOURLY(10))
  async resetPassword(@Body() dto: ResetPasswordDto, @Res({ passthrough: true }) res: Response) {
    await this.auth.resetPassword(dto.token, dto.password);
    clearSessionCookie(res);
  }

  @Post("set-password")
  @Throttle(HOURLY(10))
  @UseGuards(AuthGuard)
  async setPassword(@Req() req: Request & { user: JwtPayload }, @Body() dto: SetPasswordDto, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.auth.setPassword(req.user.sub, dto.newPassword);
    setSessionCookie(res, token);
    return { user };
  }

  @Post("email")
  @HttpCode(204)
  @Throttle(HOURLY(5))
  @UseGuards(AuthGuard)
  async addEmail(@Req() req: Request & { user: JwtPayload }, @Body() dto: AddEmailDto) {
    await this.auth.addEmail(req.user.sub, dto.email);
  }

  @Post("phone/send")
  @Throttle(HOURLY(10))
  @UseGuards(AuthGuard)
  sendPhoneLink(@Req() req: Request & { user: JwtPayload }, @Body() dto: PhoneLinkDto) {
    return this.auth.sendPhoneLink(req.user.sub, dto.phone);
  }

  @Post("phone/verify")
  @Throttle(HOURLY(20))
  @UseGuards(AuthGuard)
  verifyPhoneLink(@Req() req: Request & { user: JwtPayload }, @Body() dto: PhoneLinkVerifyDto) {
    return this.auth.verifyPhoneLink(req.user.sub, dto.phone, dto.code);
  }

  @Post("google/link")
  @Throttle(HOURLY(10))
  @UseGuards(AuthGuard)
  linkGoogle(@Req() req: Request & { user: JwtPayload }, @Body() dto: GoogleDto) {
    return this.auth.linkGoogle(req.user.sub, dto.credential);
  }

  @Post("change-password")
  @Throttle(HOURLY(10))
  @UseGuards(AuthGuard)
  async changePassword(@Req() req: Request & { user: JwtPayload }, @Body() dto: ChangePasswordDto, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.auth.changePassword(req.user.sub, dto);
    setSessionCookie(res, token);
    return { user };
  }
}
