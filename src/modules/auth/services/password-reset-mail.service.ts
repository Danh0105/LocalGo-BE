import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type { AuthConfig } from '../../../config/auth.config';

@Injectable()
export class PasswordResetMailService {
  private readonly logger = new Logger(PasswordResetMailService.name);
  private readonly config: AuthConfig;
  private readonly transporter: Transporter | null;

  constructor(configService: ConfigService) {
    this.config = configService.getOrThrow<AuthConfig>('auth');
    this.transporter = this.config.smtpHost
      ? nodemailer.createTransport({
          host: this.config.smtpHost,
          port: this.config.smtpPort,
          secure: this.config.smtpSecure,
          connectionTimeout: 5_000,
          greetingTimeout: 5_000,
          socketTimeout: 10_000,
          auth:
            this.config.smtpUser && this.config.smtpPassword
              ? {
                  user: this.config.smtpUser,
                  pass: this.config.smtpPassword,
                }
              : undefined,
        })
      : null;
  }

  async send(email: string, token: string): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        'Không gửi được email đặt lại mật khẩu vì SMTP_HOST chưa được cấu hình',
      );
      return;
    }

    const resetUrl = new URL(this.config.passwordResetUrl);
    resetUrl.searchParams.set('token', token);
    try {
      await this.transporter.sendMail({
        from: this.config.smtpFrom,
        to: email,
        subject: 'Đặt lại mật khẩu LocalGo',
        text: [
          'Bạn đã yêu cầu đặt lại mật khẩu LocalGo.',
          `Mở liên kết sau trong ${this.config.passwordResetTtlMinutes} phút:`,
          resetUrl.toString(),
          'Nếu bạn không yêu cầu thao tác này, hãy bỏ qua email.',
        ].join('\n\n'),
      });
    } catch (error) {
      // The public endpoint intentionally returns the same response regardless
      // of account existence or delivery result to prevent enumeration.
      this.logger.error(
        `Không gửi được email đặt lại mật khẩu tới ${email}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
