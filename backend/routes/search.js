import express from 'express';
import { unifiedSearch } from '../controllers/searchcontroller.js';


const router = express.Router();

router.get('/', unifiedSearch)

export default router;