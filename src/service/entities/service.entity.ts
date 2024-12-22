import { ApiProperty } from "@nestjs/swagger";
import { IsDate, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";
import { $Enums, Service } from "@prisma/client";
import { Type } from "class-transformer";

export class ServiceEntity implements Service {
    @ApiProperty()
    @IsNotEmpty({ message: 'id is required' })
    @IsNumber()
    id: number;

    @ApiProperty()
    @IsDate()
    createdAt: Date;

    @ApiProperty()
    @IsDate()
    updatedAt: Date;

    ///FOR DTO
    ///FOR DTO
    @ApiProperty()
    @IsNotEmpty({ message: 'user id is required' })
    @IsNumber({}, { message: 'user id must be a number' })
    @Type(() => Number)
    userId: number;

    @ApiProperty({ required: false })
    @IsNumber({}, { message: 'user id must be a number' })
    @IsOptional()
    @Type(() => Number)
    userIdResp: number;

    @ApiProperty({ enum: $Enums.ServiceType })
    @IsNotEmpty({ message: 'Type is required' })
    @IsEnum($Enums.ServiceType, { message: 'Type must be part of ' + Object.values($Enums.ServiceType).join(', ') })
    type: $Enums.ServiceType;

    @ApiProperty({ type: 'string' })
    @IsNotEmpty({ message: 'title is required' })
    @IsString({ message: 'title must be a string' })
    title: string;

    @ApiProperty()
    @IsNotEmpty({ message: 'description is required' })
    @IsString()
    description: string;

    @ApiProperty({ enum: $Enums.ServiceCategory })
    @IsNotEmpty({ message: 'category is required' })
    @IsEnum($Enums.ServiceCategory, { message: 'category must be part of ' + Object.values($Enums.ServiceCategory).join(', ') })
    category: $Enums.ServiceCategory;

    @ApiProperty({ enum: $Enums.SkillLevel })
    @IsNotEmpty({ message: 'skill is required' })
    @IsEnum($Enums.SkillLevel, { message: 'skill must be part of ' + Object.values($Enums.SkillLevel).join(', ') })
    skill: $Enums.SkillLevel;

    @ApiProperty({ enum: $Enums.HardLevel })
    @IsNotEmpty({ message: 'hard is required' })
    @IsEnum($Enums.HardLevel, { message: 'hard must be part of ' + Object.values($Enums.HardLevel).join(', ') })
    hard: $Enums.HardLevel;

    @ApiProperty({ enum: $Enums.ServiceStatus })
    @IsNotEmpty({ message: ' statusis required' })
    @IsEnum($Enums.ServiceStatus, { message: 'status must be part of ' + Object.values($Enums.ServiceStatus).join(', ') })
    status: $Enums.ServiceStatus;

    @ApiProperty({ type: 'string', format: 'binary', required: false })
    @IsOptional()
    @IsString({ message: 'image must be a link' })
    image: string;
}