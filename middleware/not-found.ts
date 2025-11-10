import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Request, Response } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const notFound = (_: Request, res: Response): void =>
  res.status(404).sendFile(join(__dirname, '../public/404.html'));

export default notFound;
