import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { Profile } from '@prisma/client';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
//// SERVICE MAKE ACTION
@Injectable()
export class ProfilesService {
  constructor(private prisma: PrismaService) { }
  async create(data: CreateProfileDto): Promise<Profile> {
    const { userId, addressId, userIdSp, ...profile } = data
    return await this.prisma.profile.create({ data: { ...profile, User: { connect: { id: userId } }, Address: { connect: { id: addressId } }, UserSp: { connect: { id: userIdSp } } } })
  }

  async update(id: number, data: UpdateProfileDto): Promise<Profile> {
    const { userId, addressId, userIdSp, ...profile } = data
    return await this.prisma.profile.update({
      where: { id },
      data: { ...profile, User: { connect: { id: userId } }, Address: { connect: { id: addressId } }, UserSp: { connect: { id: userIdSp } } }
    });
  }


  async findAll(): Promise<Profile[]> {
    return await this.prisma.profile.findMany();
  }

  async findOneByUserId(userId: number): Promise<Profile> {
    return this.prisma.profile.findFirstOrThrow({ where: { userId } })
  }

  async findOne(id: number): Promise<Profile> {
    return await this.prisma.profile.findUniqueOrThrow({
      where: { id },
    });

  }

  async remove(id: number): Promise<Profile> {
    return await this.prisma.profile.delete({ where: { id } });
  }
}
