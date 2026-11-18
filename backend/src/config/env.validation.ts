import { plainToInstance } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, MinLength, validateSync } from 'class-validator';

enum Environment {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @MinLength(32, { message: 'JWT_SECRET debe tener al menos 32 caracteres' })
  JWT_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_EXPIRES_IN: string = '15m';

  /** Duración de la sesión del portal de clientes (formato de jsonwebtoken: 2h, 30m…). */
  @IsOptional()
  @IsString()
  PORTAL_JWT_EXPIRES_IN?: string;

  @IsString()
  @IsNotEmpty()
  CORS_ORIGIN: string = 'http://localhost:5173';

  /** Carpeta de las fotos subidas (por defecto backend/uploads). */
  @IsOptional()
  @IsString()
  UPLOADS_DIR?: string;

  /** Carpeta del frontend compilado que sirve la API en un despliegue de un solo sitio (por omisión ./public). */
  @IsOptional()
  @IsString()
  FRONTEND_DIR?: string;

  /** Qué peticiones HTTP se muestran en la terminal: off | changes | all. */
  @IsIn(['off', 'changes', 'all'])
  LOG_HTTP: 'off' | 'changes' | 'all' = 'changes';

  // Correo (recuperación de contraseña). Con BREVO_API_KEY se usa la API HTTP de Brevo; si no, SMTP.
  // Sin ninguno de los dos, en desarrollo el código sale en la terminal.
  @IsOptional() @IsString() BREVO_API_KEY?: string;
  @IsOptional() @IsString() SMTP_HOST?: string;
  @IsOptional() @IsInt() @Min(1) @Max(65535) SMTP_PORT?: number;
  @IsOptional() @IsIn(['true', 'false']) SMTP_SECURE?: string;
  @IsOptional() @IsString() SMTP_USER?: string;
  @IsOptional() @IsString() SMTP_PASS?: string;
  @IsOptional() @IsString() MAIL_FROM?: string;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Variables de entorno inválidas:\n${errors.map((e) => e.toString()).join('\n')}`);
  }
  return validated;
}
