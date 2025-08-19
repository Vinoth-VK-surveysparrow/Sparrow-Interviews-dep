import { User } from 'firebase/auth';

/**
 * Replaces placeholders in question text with user information
 * Supports: {{first_name}} - User's first name from display name or email
 */
export function replacePlaceholders(text: string, user: User | null): string {
  if (!text || (!user?.displayName && !user?.email)) return text;
  
  // Extract first name from display name or email
  let firstName = '';
  
  if (user.displayName) {
    // If display name exists, use the first word
    firstName = user.displayName.split(' ')[0];
  } else if (user.email) {
    // If no display name, extract from email (part before @ and before any dots)
    const emailPart = user.email.split('@')[0];
    firstName = emailPart.split('.')[0];
    // Capitalize first letter
    firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
  }
  
  // Replace {{first_name}} placeholder (case insensitive)
  return text.replace(/\{\{first_name\}\}/gi, firstName);
}

/**
 * Extracts the first name from a user object
 */
export function getUserFirstName(user: User | null): string {
  if (!user) return '';
  
  if (user.displayName) {
    return user.displayName.split(' ')[0];
  } else if (user.email) {
    const emailPart = user.email.split('@')[0];
    const firstName = emailPart.split('.')[0];
    return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
  }
  
  return '';
} 