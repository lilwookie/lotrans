const express = require('express');
const router = express.Router();
const {
    handleCreate,
    handleGetAll,
    handleGetById,
    handleUpdate,
    handleDelete,
} = require('./controller');

router.post('/signup', handleCreate);
router.get('/getall', handleGetAll);
router.get('/getbyId/:id', handleGetById);
router.put('/update/:id', handleUpdate);
router.delete('/delete/:id', handleDelete);

module.exports = router;