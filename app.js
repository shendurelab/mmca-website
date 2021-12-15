const path = require('path');
const express = require('express');
const app = express();
const Database = require('better-sqlite3');

const hostname = '127.0.0.1';
const port = 3000;
const { __db_path__ } = require('./public/js/global.js')

app.use('/mmca_v2/public', express.static(path.join(__dirname, '/public')));

const db = new Database(__db_path__, { verbose: console.log, readonly: true, fileMustExist: true });

app.get('/mmca_v2', (_, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'))
});

app.get('/mmca_v2/data', (req, res) => {
  try{
    process_data_request(req.query, res);
  } catch(err) {
    console.error(err);
  }
  });

app.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/mmca_v2`);
});

process_data_request = (params, res) => {
  console.log(params);
  let get_statement = ''
  if (params.gene) {
      get_statement = db.prepare(`SELECT C.x, C.y, C.z, G.expression 
        FROM Cell C
        LEFT JOIN ${params.trajectory}_${params.background}_genes G using (cell)
        WHERE G.gene = @gene`)
  } else if (params.annotation) {
      get_statement = db.prepare(`SELECT C.x, C.y, C.z, C.${params.annotation}
        FROM Cell C
        WHERE C.background = @background and
        C.main_trajectory = @trajectory`)
  } else {
    return res.status(500).json({'error':`Invalid query parameters ${JSON.stringify(params)}`});
  }

  try {
    return res.json(get_statement.all(params));
  } catch(err) {
    return res.status(500).json({'error':`Database encountered an error: ${err}`});
  }
}
