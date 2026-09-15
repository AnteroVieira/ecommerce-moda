const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar motor de visualização EJS
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Configuração do Banco de Dados SQLite (arquivo local)
const dbFile = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbFile, (err) => {
  if (err) console.error('Erro ao abrir o banco de dados', err.message);
  else console.log('Conectado ao banco de dados SQLite com sucesso!');
});

// Criar tabela de produtos se não existir
db.run(`CREATE TABLE IF NOT EXISTS produtos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    categoria TEXT NOT NULL,
    preco REAL NOT NULL,
    imagem TEXT NOT NULL
)`);

// Configuração do Multer para salvar as fotos da câmera na pasta public/uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'public/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// --- ROTAS DO SISTEMA ---

// 1. Vitrine Pública (Home - O Site de Vendas)
app.get('/', (req, res) => {
  const categoriaFiltro = req.query.categoria;
  let query = 'SELECT * FROM produtos';
  let params = [];

  if (categoriaFiltro) {
    query += ' WHERE categoria = ?';
    params.push(categoriaFiltro);
  }

  db.all(query, params, (err, produtos) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Erro interno no servidor.');
    }
    res.render('index', { produtos, categoriaAtual: categoriaFiltro || '' });
  });
});

// 2. Tela de Cadastro (Painel)
app.get('/admin/novo', (req, res) => {
  res.render('admin');
});

// 3. Ação de Salvar o Produto (Recebe dados + Foto da Câmera)
app.post('/admin/salvar', upload.single('foto'), (req, res) => {
  const { nome, categoria, preco } = req.body;
  const imagem = req.file ? `/uploads/${req.file.filename}` : '/uploads/default.png';

  const query = `INSERT INTO produtos (nome, categoria, preco, imagem) VALUES (?, ?, ?, ?)`;
  db.run(query, [nome, categoria, preco, imagem], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Erro ao salvar produto.');
    }
    res.redirect('/');
  });
});

// 4. Ação de Excluir o Produto
app.post('/admin/excluir/:id', (req, res) => {
  const id = req.params.id;

  db.get(`SELECT imagem FROM produtos WHERE id = ?`, [id], (err, row) => {
    if (row && row.imagem && !row.imagem.includes('default.png')) {
      const imagePath = path.join(__dirname, 'public', row.imagem);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    db.run(`DELETE FROM produtos WHERE id = ?`, [id], (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Erro ao excluir produto.');
      }
      res.redirect('/');
    });
  });
});

// Iniciar Servidor na porta correta para o Codespace
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});