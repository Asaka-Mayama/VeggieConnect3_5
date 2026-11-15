/* Verify MySQL is serving VeggieConnect data. */
const mysql = require('/home/z/my-project/node_modules/mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    connectTimeout: 5000,
  });
  const [dbs] = await conn.query("SHOW DATABASES LIKE 'veggie_connect3'");
  console.log('databases:', JSON.stringify(dbs));
  const [tables] = await conn.query('SHOW TABLES FROM veggie_connect3');
  console.log('tables:', tables.map((r) => Object.values(r)[0]).join(', '));
  const [users] = await conn.query("SELECT id, name, email, role FROM veggie_connect3.users");
  console.log('users:', JSON.stringify(users));
  const [prices] = await conn.query('SELECT COUNT(*) AS n FROM veggie_connect3.da_price_bulletin');
  console.log('da_price_bulletin rows:', prices[0].n);
  const [ver] = await conn.query('SELECT VERSION() AS v');
  console.log('mysql version:', ver[0].v);
  await conn.end();
})().catch((e) => {
  console.error('VERIFY FAILED:', e.message);
  process.exit(1);
});
