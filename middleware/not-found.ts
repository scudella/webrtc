import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const notFound = (req, res) =>
  res.status(404).sendFile(join(__dirname, '../public/404.html'));

export default notFound;
