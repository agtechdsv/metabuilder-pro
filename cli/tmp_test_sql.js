const oracledb = require('oracledb');
const CONN = { user: 'crm', password: 'admin', connectString: '192.168.0.201:1521/FREEPDB1' };
async function main() {
  let conn;
  try {
    conn = await oracledb.getConnection(CONN);
    const res = await conn.execute('SELECT TABLE_NAME FROM ALL_TABLES WHERE OWNER = \'CRM\'');
    console.log('Tabelas no CRM:', res.rows);
  } catch(e) { console.error('ERRO', e.message); } finally { if(conn) await conn.close(); }
}
main();