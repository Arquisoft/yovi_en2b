import { useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { authService } from '@/services/authService'
import { isValidEmail } from '@/utils'

export function useProfileController() {
  const { user, token, updateProfile } = useAuth()

  // ── Info section ──────────────────────────────────────────────────────────
  const [username, setUsername] = useState(user?.username ?? '')
  const [email, setEmail]       = useState(user?.email ?? '')
  const [infoError, setInfoError]     = useState<string | null>(null)
  const [infoSuccess, setInfoSuccess] = useState(false)
  const [infoLoading, setInfoLoading] = useState(false)

  // ── Password section ──────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword]   = useState('')
  const [newPassword, setNewPassword]           = useState('')
  const [confirmPassword, setConfirmPassword]   = useState('')
  const [passError, setPassError]     = useState<string | null>(null)
  const [passSuccess, setPassSuccess] = useState(false)
  const [passLoading, setPassLoading] = useState(false)

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleUpdateInfo = useCallback(async () => {
    setInfoError(null)
    setInfoSuccess(false)

    if (!username.trim()) {
      setInfoError('Username is required')
      return
    }
    if (username.trim().length < 3) {
      setInfoError('Username must be at least 3 characters')
      return
    }
    if (!email.trim()) {
      setInfoError('Email is required')
      return
    }
    if (!isValidEmail(email.trim())) {
      setInfoError('Invalid email format')
      return
    }

    setInfoLoading(true)
    try {
      await updateProfile({ username: username.trim(), email: email.trim() })
      setInfoSuccess(true)
      setTimeout(() => setInfoSuccess(false), 3000)
    } catch (err) {
      setInfoError(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setInfoLoading(false)
    }
  }, [username, email, updateProfile])

  const handleChangePassword = useCallback(async () => {
    setPassError(null)
    setPassSuccess(false)

    if (!currentPassword) {
      setPassError('Current password is required')
      return
    }
    if (!newPassword) {
      setPassError('New password is required')
      return
    }
    if (newPassword.length < 6) {
      setPassError('New password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setPassError('Passwords do not match')
      return
    }

    setPassLoading(true)
    try {
      await authService.changePassword(token!, currentPassword, newPassword)
      setPassSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPassSuccess(false), 3000)
    } catch (err) {
      setPassError(err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setPassLoading(false)
    }
  }, [currentPassword, newPassword, confirmPassword, token])

  return {
    user,
    username, setUsername,
    email, setEmail,
    infoError, infoSuccess, infoLoading,
    handleUpdateInfo,
    currentPassword, setCurrentPassword,
    newPassword, setNewPassword,
    confirmPassword, setConfirmPassword,
    passError, passSuccess, passLoading,
    handleChangePassword,
  }
}