/**
 * Script de test pentru serviciul de email.
 * Rulare: npx tsx test-email.ts
 *
 * Setează variabilele de mediu înainte de rulare:
 *   SMTP_HOST=smtp.gmail.com SMTP_PORT=587 SMTP_USER=tu@gmail.com \
 *   SMTP_PASS=parola_app SMTP_FROM=tu@gmail.com npx tsx test-email.ts
 *
 * Pentru Gmail folosește un "App Password" (nu parola contului):
 *   https://myaccount.google.com/apppasswords
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '../.env') }); // root/.env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });    // backend/.env fallback
import {
  sendTaskAssignedEmail,
  sendStatusChangedEmail,
  sendCommentAddedEmail,
} from './src/services/email.service';

const TO_EMAIL = process.env.TEST_EMAIL || process.env.SMTP_USER || '';

if (!TO_EMAIL) {
  console.error('❌  Setează TEST_EMAIL sau SMTP_USER ca variabilă de mediu.');
  process.exit(1);
}

async function runTests() {
  console.log(`\n📧  Trimit emailuri de test la: ${TO_EMAIL}\n`);

  console.log('1/3 — task_assigned...');
  await sendTaskAssignedEmail(TO_EMAIL, 'Cristian', 'Implementare autentificare JWT', 'Backend API');
  console.log('    ✅ Trimis\n');

  console.log('2/3 — task_status_changed...');
  await sendStatusChangedEmail(TO_EMAIL, 'Cristian', 'Implementare autentificare JWT', 'done');
  console.log('    ✅ Trimis\n');

  console.log('3/3 — comment_added...');
  await sendCommentAddedEmail(
    TO_EMAIL,
    'Cristian',
    'Implementare autentificare JWT',
    'Alexandru Pop',
    'Am verificat codul, arată bine! Doar un mic detaliu la validarea token-ului...'
  );
  console.log('    ✅ Trimis\n');

  console.log('🎉  Toate emailurile au fost trimise. Verifică inbox-ul (și folderul Spam).');
}

runTests().catch((err) => {
  console.error('❌  Eroare:', err.message);
  process.exit(1);
});
