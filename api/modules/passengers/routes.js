const express = require('express');
const authenticateJWT = require('../../middleware/authenticateJWT');
const router = express.Router();
const {
    handleCreate,
    handleGetAll,
    handleGetById,
    handleUpdate,
    handleDelete,
} = require('./controller');

router.use(authenticateJWT);

router.post('/signup', handleCreate);
router.get('/getall', handleGetAll);
router.get('/getById/:id', handleGetById);
router.put('/update/:id', handleUpdate);
router.delete('/delete/:id', handleDelete);

module.exports = router;