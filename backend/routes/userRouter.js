import express from 'express';
import { 
  handleUserLogin, 
  handleUserSignup, handleGetMe
} from '../controllers/user.js';
import { authenticateToken } from '../middleware/auth.js';
const router = express.Router();


router.post("/login", handleUserLogin);
router.post("/signup", handleUserSignup);
router.get('/me', authenticateToken, handleGetMe);

export default router