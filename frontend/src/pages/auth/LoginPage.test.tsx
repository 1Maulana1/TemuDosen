/**
 * LoginPage smoke test (Task 3 TDD behavior).
 * Verifies the login page renders the email input and "Masuk ke Akun" CTA.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router';
import LoginPage from './LoginPage';

describe('LoginPage', () => {
  it('renders the email input', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    const emailInput = screen.getByLabelText(/email/i);
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute('type', 'email');
  });

  it('renders the "Masuk ke Akun" CTA button', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    const ctaButton = screen.getByRole('button', { name: /masuk ke akun/i });
    expect(ctaButton).toBeInTheDocument();
    expect(ctaButton).toHaveAttribute('type', 'submit');
  });

  it('renders the TemuDosen wordmark', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    expect(screen.getByText('TemuDosen')).toBeInTheDocument();
  });

  it('renders the "Daftar" link', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    const registerLink = screen.getByRole('link', { name: /daftar/i });
    expect(registerLink).toBeInTheDocument();
  });

  it('renders the password input', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    const passwordInput = screen.getByLabelText(/password/i);
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput).toHaveAttribute('type', 'password');
  });
});
