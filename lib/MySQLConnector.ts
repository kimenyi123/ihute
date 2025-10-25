// // lib/MySQLConnector.ts
// import mysql from 'mysql2/promise';

// const MySQLConnector = {
//     async mpa() {
//         return mysql.createConnection({
//             host: 'localhost',
//             user: 'root',
//             password: 'IKKW23ahe',
//             database: 'chaos_dev',
//         });
//     },
// };

// export default MySQLConnector;

// lib/MySQLConnector.ts
import mysql from 'mysql2/promise';

const MySQLConnector = {
  async mpa() {
    return mysql.createConnection({
      host: '165.227.204.67',
      user: 'algodev',
      password: 'IKKW23ahe',
      database: 'chaos_test',
    });
  },
};

export default MySQLConnector;
