import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import * as repo from './repository'
import type { User } from '../../core/types/index'

import { JWT_SECRET, JWT_EXPIRES_IN } from '../../core/config'
const SALT_ROUNDS = 10

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export interface AuthPayload {
  userId: string
  email: string
  role: string
}

function signToken(user: User): string {
  const payload: AuthPayload = { userId: user.id, email: user.email, role: user.role }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

export function verifyToken(token: string): AuthPayload {
  const payload = jwt.verify(token, JWT_SECRET) as any
  if (!payload.userId || !payload.email || !payload.role) {
    throw new AuthError('Malformed token', 401)
  }
  return payload as AuthPayload
}

function sanitizeUser(user: User) {
  const { password_hash, ...safe } = user
  return safe
}

export async function register(data: {
  email: string
  name: string
  password: string
  role?: string
}): Promise<{ user: Omit<User, 'password_hash'>; token: string }> {
  if (!data.email?.trim()) throw new AuthError('Email is required', 400)
  if (!data.name?.trim()) throw new AuthError('Name is required', 400)
  if (!data.password || data.password.length < 8) throw new AuthError('Password must be at least 8 characters', 400)
  if (!/[A-Z]/.test(data.password) || !/[a-z]/.test(data.password) || !/\d/.test(data.password)) {
    throw new AuthError('Password must contain uppercase, lowercase, and a digit', 400)
  }

  const existing = await repo.findUserByEmail(data.email)
  if (existing) throw new AuthError('Email already registered', 409)

  const password_hash = await hashPassword(data.password)
  const user = await repo.insertUser({
    email: data.email,
    name: data.name,
    password_hash,
    role: data.role,
  })

  return { user: sanitizeUser(user), token: signToken(user) }
}

export async function login(data: {
  email: string
  password: string
}): Promise<{ user: Omit<User, 'password_hash'>; token: string }> {
  if (!data.email || !data.password) throw new AuthError('Email and password are required', 400)

  const user = await repo.findUserByEmail(data.email)
  if (!user || !user.is_active) throw new AuthError('Invalid credentials', 401)

  const valid = await verifyPassword(data.password, user.password_hash)
  if (!valid) throw new AuthError('Invalid credentials', 401)

  return { user: sanitizeUser(user), token: signToken(user) }
}

export async function me(userId: string): Promise<Omit<User, 'password_hash'>> {
  const user = await repo.findUserById(userId)
  if (!user || !user.is_active) throw new AuthError('User not found', 404)
  return sanitizeUser(user)
}

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
    this.name = 'AuthError'
  }
}
