import { ApiProperty, PartialType } from '@nestjs/swagger';
import { $Enums, UserStatus } from '@prisma/client';
import { IsBoolean, IsDate, isDate, IsEmail, isEnum, IsNotEmpty, IsNumber, isNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { User } from '@prisma/client';

export class UserEntity implements User {
    @ApiProperty()
    @IsNotEmpty()
    @IsNumber()
    id: number;

    @ApiProperty()
    @IsDate()
    createdAt: Date;

    @ApiProperty()
    @IsDate()
    updatedAt: Date;

    @ApiProperty()
    @IsDate()
    lastConnection: Date;

    @ApiProperty({ enum: UserStatus, default: UserStatus.INACTIVE })
    @IsNotEmpty()
    status: UserStatus;

    ////FOR DTO
    @ApiProperty()
    @IsEmail()
    @IsNotEmpty({ message: 'Email is required' })
    @IsString()
    email: string;

    @ApiProperty()
    @IsNotEmpty({ message: 'password is required' })
    @IsString()
    @MinLength(6)
    password: string;

    @ApiProperty()
    @IsOptional()

    @IsString()
    providerId: string;

    @ApiProperty({ enum: $Enums.UserProvider, default: $Enums.UserProvider.LOCAL })
    @IsOptional()
    provider: $Enums.UserProvider;





}

