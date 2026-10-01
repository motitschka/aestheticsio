// Sets the owner's Google email in firestore.rules.  npm run set-admin -- you@gmail.com
import { readFile, writeFile } from 'node:fs/promises'

const email = process.argv[2]?.trim().toLowerCase()
if (!email || !/^[^@\s']+@[^@\s']+$/.test(email)) {
  console.error('Usage: npm run set-admin -- you@gmail.com')
  process.exit(1)
}

const file = new URL('../firestore.rules', import.meta.url)
const rules = await readFile(file, 'utf8')
const updated = rules.replace(/(function adminEmail\(\) \{\s*return ')[^']*(';)/, `$1${email}$2`)
if (updated === rules && !rules.includes(`'${email}'`)) {
  console.error('Could not find adminEmail() in firestore.rules')
  process.exit(1)
}
await writeFile(file, updated)
console.log(`Owner set to ${email}. Deploy the rules with: npm run deploy:rules`)
