import mysql from 'mysql2/promise'

const connection = await mysql.createConnection({
  host: process.env.MERIRIDE_DB_HOST || '127.0.0.1',
  port: Number(process.env.MERIRIDE_DB_PORT || 3306),
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
})

try {
  const [columns] = await connection.query('SHOW COLUMNS FROM vehicle')
  const existing = new Set(columns.map((column) => column.Field))
  if (!existing.has('category')) {
    await connection.query("ALTER TABLE vehicle ADD COLUMN category VARCHAR(32) NOT NULL DEFAULT 'standard'")
  }
  if (!existing.has('image_data')) {
    await connection.query('ALTER TABLE vehicle ADD COLUMN image_data MEDIUMTEXT NULL')
  }
  console.log('Vehicle category and image fields are ready.')
} finally {
  await connection.end()
}
