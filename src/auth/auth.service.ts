//src/auth/auth.service.ts
import { HttpException, Injectable } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { SignInDto } from './dto/signIn.dto';
import { $Enums, User } from '@prisma/client';
import { MailerService } from 'src/mailer/mailer.service';


@Injectable()
export class AuthService {
    constructor(private prisma: PrismaService, private jwtService: JwtService, private mailerService: MailerService) { }

    async generateAccessToken(sub: number) { return this.jwtService.sign({ sub }, { secret: process.env.JWT_SECRET, expiresIn: process.env.JWT_EXPIRES_ACCESS }) }

    async generateRefreshToken(sub: number) { return this.jwtService.sign({ sub }, { secret: process.env.JWT_SECRET_REFRESH, expiresIn: process.env.JWT_EXPIRES_REFRESH }) }

    async generateVerifyToken(sub: number) { return this.jwtService.sign({ sub }, { secret: process.env.JWT_SECRET, expiresIn: process.env.JWT_EXPIRES_VERIFY }) }

    errorCredentials = { message: 'Identifiants incorrect' }

    async setAuthCookies(res: Response, accessToken: string) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.cookie(process.env.ACCESS_COOKIE_NAME, accessToken, {
            httpOnly: true,
            // domain: process.env.DOMAIN,
            secure: true,
            sameSite: 'strict',
            maxAge: parseInt(process.env.COOKIE_EXPIRES_ACCESS),
            path: '/',
        });
        console.log('Headers après définition du cookie:', res.getHeaders());
    }

    includeConfigUser = { Profile: { include: { Address: true } }, GroupUser: true }
    async signUp(data: SignInDto): Promise<{ message: string }> {
        const { email, password } = data
        const user = await this.prisma.user.findUnique({ where: { email: email } });
        if (user) return { message: 'Vous avez déjà un compte' };
        const hashPassword = await argon2.hash(password);
        const createdUser = await this.prisma.user.create({ data: { email, password: hashPassword } });
        const verifyToken = await this.generateRefreshToken(createdUser.id);
        const hashToken = await argon2.hash(verifyToken);
        await this.prisma.token.create({
            data: { userId: createdUser.id, token: hashToken, type: $Enums.TokenType.VERIFY }
        })
        this.mailerService.sendVerificationEmail(email, verifyToken)
        return { message: 'Votre compte à bien été crée, veuillez cliquer sur le lien envoyé par email' }
    }

    //// SIGN IN
    async signIn(data: SignInDto, res: Response): Promise<{ refreshToken: string, user: Partial<User> } | { message: string }> {
        const { email, password } = data
        const user = await this.prisma.user.findUnique({ where: { email }, include: this.includeConfigUser });
        if (!user) return this.errorCredentials
        const isPasswordValid = await argon2.verify(user.password, password)
        if (!isPasswordValid) return this.errorCredentials
        if (user.status === $Enums.UserStatus.INACTIVE) {
            this.mailerService.sendVerificationEmail(email, await this.generateVerifyToken(user.id));
            return { message: 'Votre compte est inactif, veuillez verifier votre email' }
        }
        const refreshToken = await this.generateRefreshToken(user.id);
        const accessToken = await this.generateAccessToken(user.id);
        await this.prisma.token.deleteMany({
            where: { userId: user.id }
        })
        await this.prisma.token.create({
            data: {
                userId: user.id,
                token: await argon2.hash(refreshToken),
                type: $Enums.TokenType.REFRESH
            }
        })
        this.setAuthCookies(res, accessToken);
        user.password = ''
        return { refreshToken, user }
    }

    //// SIGN IN VERIFY
    async signInVerify(data: SignInDto & { verifyToken: string }, res: Response): Promise<{ refreshToken: string, user: Partial<User> } | { message: string }> {
        const { email, password, verifyToken } = data
        const user = await this.prisma.user.findUniqueOrThrow({ where: { email: email }, include: this.includeConfigUser });
        if (!user) return this.errorCredentials
        const userToken = await this.prisma.token.findFirst({ where: { userId: user.id, type: $Enums.TokenType.VERIFY } })
        if (!userToken) return this.errorCredentials
        const refreshTokenValid = await argon2.verify(userToken.token, verifyToken)
        if (!refreshTokenValid) return this.errorCredentials
        const isPasswordValid = await argon2.verify(user.password, password)
        if (!isPasswordValid) return this.errorCredentials
        const accessToken = await this.generateAccessToken(user.id);
        const refreshToken = await this.generateRefreshToken(user.id);
        await this.prisma.user.update({ where: { id: user.id }, data: { status: $Enums.UserStatus.ACTIVE } })
        await this.prisma.token.deleteMany({ where: { userId: user.id, type: $Enums.TokenType.REFRESH } })
        await this.prisma.token.create({ data: { userId: user.id, token: await argon2.hash(refreshToken), type: $Enums.TokenType.REFRESH } })
        this.setAuthCookies(res, accessToken);
        user.password = ''
        return { refreshToken, user }
    }


    async refresh(refreshToken: string, userId: number, res: Response): Promise<{ refreshToken: string } | { message: string }> {
        // Use PrismaClientTransaction to avoid errror in case of multi entrance in the same time
        return await this.prisma.$transaction(async (prisma) => {
            try {
                const userToken = await prisma.token.findFirst({ where: { userId: userId, type: $Enums.TokenType.REFRESH } });
                if (!userToken) throw new HttpException('Impossible de renouveller la connexion , identifiez vous ', 403);
                const refreshTokenValid = await argon2.verify(userToken.token, refreshToken.trim());
                if (!refreshTokenValid) throw new HttpException('connexion interrompue, re-identifiez vous ', 403);
                await prisma.token.deleteMany({ where: { userId, type: $Enums.TokenType.REFRESH } });
                const accessToken = await this.generateAccessToken(userId);
                const newRefreshToken = await this.generateRefreshToken(userId)
                await prisma.token.create({
                    data: { userId, token: await argon2.hash(newRefreshToken), type: $Enums.TokenType.REFRESH }
                });
                await this.setAuthCookies(res, accessToken)
                return { refreshToken: newRefreshToken };
            } catch (error) {
                throw new HttpException(error.message, 401);
            }
        });
    }

    async logOut(userId: number, res: Response): Promise<{ message: string }> {
        await this.prisma.token.deleteMany({ where: { userId, type: $Enums.TokenType.REFRESH } });
        res.clearCookie(process.env.ACCESS_COOKIE_NAME);
        return { message: 'Vous etes deconnecté' }
    }

    async deletAccount(userId: number): Promise<{ message: string }> {
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
        const deleteToken = await this.generateVerifyToken(user.id);
        const deleteTokenHash = await argon2.hash(deleteToken);
        const userToken = await this.prisma.token.findFirst({ where: { userId: userId, type: $Enums.TokenType.DELETE } });
        userToken && await this.prisma.token.delete({ where: { userId_type: { userId: userId, type: $Enums.TokenType.DELETE } } });
        await this.prisma.token.create({ data: { userId: user.id, token: deleteTokenHash, type: $Enums.TokenType.DELETE } })
        this.mailerService.sendDeleteAccountEmail(user.email, deleteToken);
        return { message: 'Un email avec le lien de suppression vous a été envoyé' }
    }

    async deletAccountConfirm(userId: number, email: string, deleteToken: string): Promise<{ message: string }> {
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
        if (user.email !== email) throw new HttpException('Vous n\'avez pas le droit de supprimer ce compte', 403);
        const userToken = await this.prisma.token.findFirst({ where: { userId: userId, type: $Enums.TokenType.DELETE } });
        const deleteTokenValid = await argon2.verify(userToken.token, deleteToken.trim());
        if (!deleteTokenValid) throw new HttpException('Vous n\'avez pas le droit de supprimer ce compte', 403);
        await this.prisma.user.delete({ where: { id: userId } });
        return { message: 'Votre compte a bien été supprimé' }
    }


    async deleteTester() {
        if (process.env.NODE_ENV === 'dev') { await this.prisma.user.deleteMany({ where: { email: 'collectif_tester@imagindev.com' } }) }
        return { message: 'Les utilisateurs de test ont été supprimés' }
    }


}