import { generateContentFormPDF } from './server/pdfForms';
import { writeFileSync } from 'fs';

async function main() {
  const types = ['video','written','audio','images','social','design','games','film','other'] as const;
  for (const t of types) {
    const buf = await generateContentFormPDF(t);
    writeFileSync(`/tmp/test-${t}.pdf`, buf);
    console.log(`${t}: ${buf.length} bytes`);
  }
}

main().catch(console.error);
