const path = require('path');
const express = require('express');
const app = express();
const sqlite3 = require('sqlite3').verbose();

const hostname = '127.0.0.1';
const port = 3000;
const { __db_path__ } = require('./public/js/global.js')

app.use('/mmca_v2/public', express.static(path.join(__dirname, '/public')));

console.log(__dirname);

const db = new sqlite3.Database(__db_path__, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.log('Failed connection to database');
    console.error(err);
  } else {
    console.log('Established connection to database');
  }
});

app.get('/mmca_v2', (_, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'))
});

app.get('/mmca_v2/data', (req, res) => {
  try {
    process_data_request(req.query, res);
  } catch (err) {
    console.error(err);
  }
});

app.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/mmca_v2`);
});

process_data_request = (params, res) => {
  let sql = '';
  if (params.gene) {
    sql = `select x, y, z, ifnull(expression, 0) as expression
          from (select c.x, c.y, c.z, g.value * ${params.annotation.includes('count') ? '1' : 'c.factor'} as expression
            from cell c
            left join (
                select key, value 
                from (
                    select value as v 
                    from gene, json_each(json(data))
                    where background = '${params.background}' 
                        and main_trajectory = '${params.trajectory}'
                        and mutant = '${params.mutant}' 
                        and gene = '${params.gene}'
                ) j, json_each(j.v)
            ) g on g.key = c.cell
            where background = '${params.background}' 
            and main_trajectory = '${params.trajectory}'
            and mutant = '${params.mutant}'
          ) j`
  } else if (params.annotation) {
    sql = `SELECT C.x, C.y, C.z, C.${params.annotation}
              FROM Cell C
              WHERE C.background = '${params.background}' and
              C.main_trajectory = '${params.trajectory}' and
              C.mutant = '${params.mutant}'`
  } else {
    return res.status(500).json({ 'error': `Invalid query parameters ${JSON.stringify(params)}` });
  }


  db.all(sql, (err, rows) => {
    if (err) {
      return res.status(500).json({ 'error': `Database encountered an error: ${err}` });
    }
    return res.json(rows);
  });
}
