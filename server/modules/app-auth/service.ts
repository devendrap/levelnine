import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import * as repo from './repository'
import * as containerRepo from '../containers/repository'
import type { AppUser } from '../../core/types/index'

import { JWT_SECRET, JWT_EXPIRES_IN } from '../../core/config'
const SALT_ROUNDS = 10

export interface AppAuthPayload {
  userId: string
  email: string
  role: string
  containerId: string
  type: 'app'
}

function signToken(user: AppUser): string {
  const payload: AppAuthPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    containerId: user.container_id,
    type: 'app',
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

export function verifyAppToken(token: string): AppAuthPayload {
  const payload = jwt.verify(token, JWT_SECRET) as any
  if (payload.type !== 'app') throw new AppAuthError('Not an app token', 401)
  if (!payload.userId || !payload.email || !payload.role || !payload.containerId) {
    throw new AppAuthError('Malformed app token', 401)
  }
  return payload as AppAuthPayload
}

function sanitize(user: AppUser) {
  const { password_hash, ...safe } = user
  return safe
}

export class AppAuthError extends Error {
  constructor(message: string, public status: number) {
    super(message)
    this.name = 'AppAuthError'
  }
}

export async function register(data: {
  slug: string
  email: string
  name: string
  password: string
}) {
  if (!data.email?.trim()) throw new AppAuthError('Email is required', 400)
  if (!data.name?.trim()) throw new AppAuthError('Name is required', 400)
  if (!data.password || data.password.length < 8) throw new AppAuthError('Password must be at least 8 characters', 400)
  if (!/[A-Z]/.test(data.password) || !/[a-z]/.test(data.password) || !/\d/.test(data.password)) {
    throw new AppAuthError('Password must contain uppercase, lowercase, and a digit', 400)
  }

  const container = await containerRepo.findContainerBySlug(data.slug)
  if (!container || container.status !== 'launched') throw new AppAuthError('App not found', 404)

  const existing = await repo.findByEmail(data.email, container.id)
  if (existing) throw new AppAuthError('Email already registered for this app', 409)

  const password_hash = await bcrypt.hash(data.password, SALT_ROUNDS)
  const user = await repo.insert({
    container_id: container.id,
    email: data.email,
    name: data.name,
    password_hash,
  })

  return { user: sanitize(user), token: signToken(user) }
}

export async function login(data: {
  slug: string
  email: string
  password: string
}) {
  if (!data.email || !data.password) throw new AppAuthError('Email and password are required', 400)

  const container = await containerRepo.findContainerBySlug(data.slug)
  if (!container || container.status !== 'launched') throw new AppAuthError('App not found', 404)

  const user = await repo.findByEmail(data.email, container.id)
  if (!user || !user.is_active) throw new AppAuthError('Invalid credentials', 401)

  const valid = await bcrypt.compare(data.password, user.password_hash)
  if (!valid) throw new AppAuthError('Invalid credentials', 401)

  return { user: sanitize(user), token: signToken(user) }
}

export async function me(userId: string) {
  const user = await repo.findById(userId)
  if (!user || !user.is_active) throw new AppAuthError('User not found', 404)
  return sanitize(user)
}

export async function listUsers(containerId: string) {
  const users = await repo.findByContainer(containerId)
  return users.map(sanitize)
}

export async function inviteUser(data: {
  containerId: string
  email: string
  name: string
  role: string
  invitedBy: string
}) {
  if (!data.email?.trim()) throw new AppAuthError('Email is required', 400)
  if (!data.name?.trim()) throw new AppAuthError('Name is required', 400)

  const existing = await repo.findByEmail(data.email, data.containerId)
  if (existing) throw new AppAuthError('User already exists in this app', 409)

  // Generate a temporary password — user should change on first login
  const tempPassword = crypto.randomUUID().slice(0, 12)
  const password_hash = await bcrypt.hash(tempPassword, SALT_ROUNDS)

  const user = await repo.insert({
    container_id: data.containerId,
    email: data.email,
    name: data.name,
    password_hash,
    role: data.role,
    invited_by: data.invitedBy,
  })

  // TODO: send tempPassword via email (C2 notification engine) instead of API response
  console.info(`[invite] Temp password for ${data.email}: ${tempPassword}`)
  return { user: sanitize(user) }
}

export async function updateUser(id: string, data: { role?: string; is_active?: boolean }) {
  const user = await repo.update(id, data)
  if (!user) throw new AppAuthError('User not found', 404)
  return sanitize(user)
}

export async function removeUser(id: string) {
  const ok = await repo.remove(id)
  if (!ok) throw new AppAuthError('User not found', 404)
}
