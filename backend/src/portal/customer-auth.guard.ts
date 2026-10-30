import { CanActivate, createParamDecorator, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { issuedBeforePasswordChange } from '../common/utils/token-revocation';
import { PrismaService } from '../prisma/prisma.service';

/** Tipo de token del portal: distingue la sesión de un cliente de la del personal interno. */
export const CUSTOMER_TOKEN_TYPE = 'customer';

export interface CustomerJwtPayload {
  sub: string; // cuenta del portal (customer_accounts.id)
  cid: string; // cliente (customers.id)
  typ: typeof CUSTOMER_TOKEN_TYPE;
  iat?: number;
  exp?: number;
  iatMs?: number;
}

/** Cliente autenticado en el portal; lo arma el servidor a partir de la base de datos. */
export interface PortalCustomer {
  accountId: string;
  customerId: string;
  email: string;
  contactName: string;
  customerName: string;
}

/**
 * Guard del portal de clientes (separado del login interno). Exige un JWT de tipo "customer",
 * comprueba que la cuenta y el cliente sigan activos y que el token sea posterior al último
 * cambio de contraseña. Un token del personal no sirve aquí y uno de cliente no sirve en la API
 * interna (JwtStrategy lo rechaza).
 */
@Injectable()
export class CustomerAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ headers: { authorization?: string }; customer?: PortalCustomer }>();
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException('Inicie sesión para continuar');

    let payload: CustomerJwtPayload;
    try {
      payload = await this.jwt.verifyAsync<CustomerJwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Su sesión venció; inicie sesión de nuevo');
    }
    if (payload.typ !== CUSTOMER_TOKEN_TYPE) throw new UnauthorizedException('Esta sesión no es del portal de clientes');

    const account = await this.prisma.customerAccount.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        customerId: true,
        email: true,
        contactName: true,
        isActive: true,
        passwordChangedAt: true,
        customer: { select: { name: true, isActive: true } },
      },
    });
    if (!account || !account.isActive || !account.customer.isActive) throw new UnauthorizedException('La cuenta no está activa');
    if (issuedBeforePasswordChange(payload.iat, account.passwordChangedAt, payload.iatMs)) {
      throw new UnauthorizedException('La contraseña cambió; inicie sesión de nuevo');
    }

    req.customer = {
      accountId: account.id,
      customerId: account.customerId,
      email: account.email,
      contactName: account.contactName,
      customerName: account.customer.name,
    };
    return true;
  }
}

/** Inyecta el cliente autenticado del portal en el controller. */
export const CurrentCustomer = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PortalCustomer => ctx.switchToHttp().getRequest<{ customer: PortalCustomer }>().customer,
);
