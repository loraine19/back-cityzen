import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreateVoteDto } from './dto/create-vote.dto';
import { UpdateVoteDto } from './dto/update-vote.dto';
import { PrismaService } from '../prisma/prisma.service';
import { $Enums, Vote } from '@prisma/client';
import { NotificationsService } from 'src/notifications/notifications.service';
import { UserNotifInfo } from 'src/notifications/entities/notification.entity';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class VotesService {
  constructor(private prisma: PrismaService, private notificationsService: NotificationsService, private usersService: UsersService) { }

  private userSelectConfig = { id: true, email: true, GroupUser: true, Profile: { select: { mailSub: true, firstName: true } } }

  async create(data: CreateVoteDto): Promise<Vote> {
    const { targetId, target, userId, opinion } = data
    const find = target === $Enums.VoteTarget.POOL ?
      await this.prisma.pool.findUnique({ where: { id: targetId }, select: { User: { select: this.userSelectConfig }, status: true, Votes: true, UserBenef: { select: this.userSelectConfig } } }) :
      await this.prisma.survey.findUnique({ where: { id: targetId }, select: { User: { select: this.userSelectConfig }, title: true, status: true, Votes: true } });
    if (!find) throw new HttpException(`${target} n'existe pas`, HttpStatus.NOT_FOUND);
    if (find.status === $Enums.PoolSurveyStatus.REJECTED) throw new HttpException('Vous ne pouvez pas voter sur cette cagnotte/sondage car il est cloturé', 403);
    const title = target === $Enums.VoteTarget.SURVEY && 'title' in find ? find.title : find.User.Profile.firstName
    const vote = await this.prisma.vote.findUnique({ where: { userId_target_targetId: { userId, targetId, target } } });
    if (vote) throw new HttpException('Vous avez déjà voté', 403)
    const voteCount = find.Votes.filter(vote => vote.opinion === $Enums.VoteOpinion.OK).length
    const groupIds = find.User.GroupUser.map(g => g.groupId)
    const users = await this.usersService.usersInGroup(find.User.id, groupIds)
    const isValided = opinion === $Enums.VoteOpinion.OK && ((voteCount + 1) / users.length >= 0.51)
    const notification = (typeEnum: $Enums.NotificationType, type: string, id: number) => ({
      type: typeEnum,
      level: $Enums.NotificationLevel.SUB_3,
      title: `${type} est expiré`,
      description: `Un utilisateur a voté : ${opinionS}, à votre ${type} pour ${title} ${isValided ? 'et a validé la cagnotte' : ''}`,
      link: `/${type}/${id}`
    });

    const validatedNotification = {
      type: $Enums.NotificationType.VOTE,
      level: $Enums.NotificationLevel.SUB_2,
      title: 'Descition de vote',
      description: target === $Enums.VoteTarget.POOL ? `Cagnotte ` : `Sondage ` + `${title} a été validé`,
      link: target === $Enums.VoteTarget.POOL ? `/cagnotte/${targetId}` : `/sondage/${targetId}`
    }
    const opinionS = opinion === $Enums.VoteOpinion.OK && 'pour ' || opinion === $Enums.VoteOpinion.NO && 'contre ' || 'neutre'
    if (target === $Enums.VoteTarget.POOL) {
      const vote = await this.prisma.vote.create({
        data: {
          opinion, target, Pool: { connect: { id: targetId } },
          User: { connect: { id: userId } },
        }
      })
      await this.notificationsService.create(new UserNotifInfo(find.User), notification($Enums.NotificationType.VOTE, 'cagnotte', targetId))
      if (isValided) {

        await this.prisma.pool.update({ where: { id: targetId }, data: { status: $Enums.PoolSurveyStatus.VALIDATED } })
        if ('userIdBenef' in find && typeof find.userIdBenef === 'number' && find.userIdBenef) {
          await this.prisma.profile.update({ where: { userId: find.userIdBenef }, data: { points: { increment: 10 } } });
        }

      }
      return vote
    }
    else if (target === $Enums.VoteTarget.SURVEY) {
      const vote = await this.prisma.vote.create({
        data: { opinion, target, Survey: { connect: { id: targetId } }, User: { connect: { id: userId } } },
        include: { Survey: true }
      })
      await this.notificationsService.create(new UserNotifInfo(find.User), notification($Enums.NotificationType.VOTE, 'sondage', targetId))
      if (isValided) {
        await this.prisma.survey.update({ where: { id: targetId }, data: { status: $Enums.PoolSurveyStatus.VALIDATED } })
        await this.notificationsService.createMany(users, validatedNotification)
        return vote
      }
    }
  }


  async update(userId: number, data: UpdateVoteDto): Promise<Vote> {
    const { targetId, target } = data
    const vote = await this.prisma.vote.findUnique({ where: { userId_target_targetId: { userId, targetId: data.targetId, target: data.target } } });
    if (!vote) throw new HttpException('Votre vote n\'existe pas', 404)
    if (vote.createdAt.getTime() + 24 * 60 * 60 * 1000 < new Date().getTime()) throw new HttpException('Vous ne pouvez pas modifier ce vote, il est trop vieux', 403)
    return await this.prisma.vote.update({
      where: { userId_target_targetId: { userId, targetId, target } },
      data: { ...data },
    });
  }

  async remove(userId: number, targetId: number, target: $Enums.VoteTarget,): Promise<Vote> {
    return await this.prisma.vote.delete({ where: { userId_target_targetId: { userId, targetId, target } }, });
  }
}