import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'

const directory = path.dirname(fileURLToPath(import.meta.url))
const schema = await readFile(path.join(directory, 'cloud-schema.sql'), 'utf8')

const connection = await mysql.createConnection({
  host: process.env.MERIRIDE_BOOTSTRAP_HOST || '127.0.0.1',
  port: Number(process.env.MERIRIDE_BOOTSTRAP_PORT || 3306),
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  multipleStatements: true,
})

try {
  await connection.query(schema)
  const [tables] = await connection.query('SHOW TABLES')
  console.log(`Cloud schema initialized (${tables.length} tables). No data was imported.`)
} finally {
  await connection.end()
}
