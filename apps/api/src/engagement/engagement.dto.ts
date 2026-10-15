import { IsInt, IsOptional, IsString, Matches, MaxLength, Max, Min, MinLength } from "class-validator";

export class TrackViewDto {
  @IsString() @MaxLength(200) slug!: string;
  @Matches(/^[A-Za-z0-9-]{8,64}$/) visitorId!: string;
}

export class ReviewDto {
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsString() @MinLength(3) @MaxLength(2000) body!: string;
}

export class QuestionDto {
  @IsString() @MinLength(10) @MaxLength(500) question!: string;
}

export class AnswerDto {
  @IsString() @MinLength(2) @MaxLength(1000) answer!: string;
}
