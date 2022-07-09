const mysql      = require('mysql');
const connection = mysql.createConnection({
  host     : process.env.SQL_HOST || 'localhost',
  user     : process.env.SQL_USER || 'me',
  password : process.env.SQL_PASS || '',
  database : process.env.SQL_DATABASE || 'my_db',

  port: process.env.PORTDB,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const connect = () => connection.connect(function(err) {
    if (err) {
        console.error('error connecting: ' + err.stack);
        return;
    }

    console.log('Conexion correcta con tu base de datos MySQL')
});

module.exports = {connect, connection}