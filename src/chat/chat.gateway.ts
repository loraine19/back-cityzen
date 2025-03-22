import { UseGuards } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsAuthGuard } from 'src/auth/auth.guard';
import { CreateMessageDto } from 'src/messages/dto/create-message.dto';
import { MessagesService } from 'src/messages/messages.service';
import { PrismaService } from 'src/prisma/prisma.service';

const WS = 'chat';
@UseGuards(WsAuthGuard)
@WebSocketGateway({
  namespace: '/' + WS,
  cors: {
    origin: [process.env.NEST_ENV !== 'dev' ? process.env.FRONT_URL : '*'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly meessagesService: MessagesService) { }

  @SubscribeMessage(`${WS}-message`)
  async handleMessage(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const userId = client.user;
    const { userIdRec, message } = data;

    // if (!message) {
    //   const errorMsg = 'Message is required';
    //   throw new WsException(errorMsg);
    // }


    const room = this.getRoomName(userId.toString());
    client.join(room);
    this.server.to(room).emit('newMessage', 'newMessage');


    if (userIdRec) {
      const newMessage = await this.meessagesService.create({ userId, userIdRec, message })
      this.server.to(this.getRoomName(userIdRec)).emit('newMessage', newMessage);
    }
  }

  private getRoomName(userId1: string): string {
    const roomName = [userId1, 'chat'].sort().join('-');
    console.log(`[SERVER] Room name generated: ${roomName} from users ${userId1} `);
    return roomName;
  }


}



