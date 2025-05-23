import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { $Enums, User } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as argon2 from 'argon2';
import { UserNotifInfo } from 'src/notifications/entities/notification.entity';


//// SERVICE MAKE ACTION
@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) { }

  async create(data: CreateUserDto): Promise<User> {
    let user = { ...data };
    const userFind = await this.prisma.user.findUnique({ where: { email: user.email } });
    if (userFind) throw new HttpException('User already exists', HttpStatus.CONFLICT);
    user.password = await argon2.hash(user.password);
    const createdUser = await this.prisma.user.create({ data: user });
    return { ...createdUser, password: undefined }
  }

  async findAll(): Promise<Partial<User>[]> {
    return await this.prisma.user.findMany({
      select: {
        id: true,
        Profile: { include: { Address: true } }
      }
    });
  }

  async findAllModo(id: number): Promise<Partial<User>[]> {
    /// TODO Pass groupId in params
    const user = await this.prisma.user.findUnique({ where: { id }, include: { GroupUser: true } });
    return await this.prisma.user.findMany({
      where: {
        id: { not: id },
        GroupUser: {
          some: {
            groupId: { in: user.GroupUser.map(g => g.groupId) },
            role: { equals: $Enums.Role.MODO }
          }
        }
      },
      select: {
        id: true,
        email: true,
        GroupUser: true,
        Profile: { include: { Address: true } }
      },
    });
  }


  async findOne(id: number): Promise<Partial<User>> {
    /// TODO: check if user is in group
    return await this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        email: true,
        lastConnection: true,
        status: true,
        Profile: { include: { Address: true } },
        GroupUser: { include: { Group: true } }
      },
    });
  }

  async findUnique(email: string): Promise<User> {
    return await this.prisma.user.findUniqueOrThrow({ where: { email } });
  }

  async count(userId: number): Promise<number> {
    return await this.prisma.user.count()
  }

  async usersInGroup(userId: number, groupId: number[]): Promise<UserNotifInfo[]> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { GroupUser: true } });
    if (!user) throw new NotFoundException('cette utilisateur n\'existe pas');
    // console.log(user.GroupUser, groupId);
    // if (!user.GroupUser.some(g => g.groupId in groupId)) throw new HttpException('Vous ne faites pas partie de ce groupe', 403);

    return await this.prisma.user.findMany({
      where: {
        GroupUser: { some: { groupId: { in: groupId } } }
      },
      select: {
        id: true,
        email: true,
        Profile: { select: { mailSub: true } }
      },
    });
  }

  async update(id: number, user: UpdateUserDto): Promise<User> {
    const existingUser = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    if (!existingUser) { throw new NotFoundException(`User with id ${id} not found`) }
    if (user.password) { user.password = await argon2.hash(user.password); }
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { ...user, password: user.password },
      include: { Profile: true }
    });
    return { ...updatedUser, password: undefined }
  }

  async remove(id: number, userId: number): Promise<{ message: string }> {
    if (userId !== id) throw new HttpException('Vous n\'avez pas le droit de supprimer cet utilisateur', 403)
    await this.prisma.user.delete({ where: { id } });
    return { message: 'User deleted successfully' };

  }
}