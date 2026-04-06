import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserContext } from '../dto/user-context.dto.js';
import { HEADERS } from '../constants/headers.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserContext => {
    const request = ctx.switchToHttp().getRequest();
    return {
      userId: request.headers[HEADERS.USER_ID] ?? '',
      email: request.headers[HEADERS.USER_EMAIL] ?? '',
      role: request.headers[HEADERS.USER_ROLE] ?? '',
    };
  },
);
