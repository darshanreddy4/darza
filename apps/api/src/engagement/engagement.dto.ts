import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Max, Min, MinLength, ValidateNested } from "class-validator";

export class TrackViewDto {
  @IsString() @MaxLength(200) slug!: string;
  @Matches(/^[A-Za-z0-9-]{8,64}$/) visitorId!: string;
}

// A picture or video the customer uploaded with the review uploader; nothing from elsewhere on the internet.
export class ReviewMediaDto {
  @IsIn(["IMAGE", "VIDEO"]) type!: "IMAGE" | "VIDEO";
  @Matches(/^\/uploads\/[a-f0-9]{32}\.(webp|jpg|png|mp4|webm)$/) url!: string;
}

export class ReviewDto {
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsString() @MinLength(3) @MaxLength(2000) body!: string;
  @IsOptional() @IsArray() @ArrayMaxSize(6) @ValidateNested({ each: true }) @Type(() => ReviewMediaDto) media?: ReviewMediaDto[];
}

export class QuestionDto {
  @IsString() @MinLength(10) @MaxLength(500) question!: string;
}

export class AnswerDto {
  @IsString() @MinLength(2) @MaxLength(1000) answer!: string;
}
