import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { Group, GroupCategory } from '@prisma/client';
import { UpdateGroupDto } from './dto/update-group.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupFilter } from './constant';

@Injectable()
export class GroupsService {
  constructor(private prisma: PrismaService) { }


  private groupIncludeConfig = {
    GroupUser: { include: { User: { select: { id: true, email: true, Profile: true } } } },
    Address: true
  }

  private userSelectConfig = {
    id: true,
    email: true,
    Profile: { select: { mailSub: true, Address: true } }
  }


  async create(data: CreateGroupDto): Promise<Group> {
    const { addressId, ...group } = data
    return await this.prisma.group.create({ data: { ...group, Address: { connect: { id: addressId } } }, include: this.groupIncludeConfig });
  }

  limit = parseInt(process.env.LIMIT)
  skip(page: number) { return (page - 1) * this.limit }

  async findAll(): Promise<Group[]> {
    return await this.prisma.group.findMany({
      include: this.groupIncludeConfig,
    });
  }

  async findOne(id: number): Promise<Group> {
    return await this.prisma.group.findUniqueOrThrow({
      where: { id },
      include: this.groupIncludeConfig,
    })
  }

  async findAllByUserId(userId: number): Promise<Group[]> {
    const groups = await this.prisma.group.findMany({
      where: { GroupUser: { every: { User: { id: userId } } } },
      include: this.groupIncludeConfig,
    })
    if (groups.length === 0) throw new HttpException('msg: Vous n\'avez aucun groupe', HttpStatus.NO_CONTENT)
    return groups
  }

  async findNearestGroups(userId: number, page?: number, filter?: string, category?: string): Promise<{ groups: Group[], count: number }> {
    const skip = (page && page !== 0) ? this.skip(page) : 0;
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: this.userSelectConfig })
    const Address = { city: user.Profile.Address.city }
    let where: any = { Address }
    category ? where = { ...where, category: GroupCategory[category] } : null
    switch (filter) {
      case GroupFilter.IMIN:
        where = { ...where, GroupUser: { some: { userId: userId } } }; break;
      case GroupFilter.IMODO:
        where = { ...where, GroupUser: { some: { userId: userId, role: 'MODO' } } }; break;
      default:
        where = { ...where }
    }
    const count = await this.prisma.group.count({ where })
    const take = (page && page !== 0) ? this.limit : count;
    const groups = await this.prisma.group.findMany({ where, skip, take, include: this.groupIncludeConfig }) || []
    return { groups, count }
  }



  async update(id: number, data: UpdateGroupDto): Promise<Group> {
    const { addressId, ...group } = data
    return await this.prisma.group.update({
      where: { id },
      data: { ...group, Address: { connect: { id: addressId } } },
      include: this.groupIncludeConfig,
    });
  }

  async remove(id: number): Promise<Group> {
    return await this.prisma.group.delete({ where: { id } });
  }
}
