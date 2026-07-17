import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { createReadStream } from 'node:fs';
import { Public } from '../../../common/decorators/public.decorator';
import { BusinessDocumentAccessService } from '../services/business-document-access.service';

@ApiExcludeController()
@Controller('business-application-documents')
export class BusinessDocumentController {
  constructor(private readonly accessService: BusinessDocumentAccessService) {}

  @Public()
  @Get(':id')
  async download(
    @Param('id') id: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Res() response: Response,
  ): Promise<void> {
    const document = await this.accessService.resolveDownload(
      id,
      Number(expires),
      signature,
    );
    response.setHeader('Content-Type', document.mimeType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(document.name)}`,
    );
    response.setHeader('Cache-Control', 'private, no-store');
    createReadStream(document.filePath).pipe(response);
  }
}
