/**
 * LoginPage smoke test (Task 3 TDD behavior).
 * Verifies the login page renders the NIM/NIDN input and "Masuk" CTA.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router';
import LoginPage from './LoginPage';

describe('LoginPage', () => {
  it('renders the NIM/NIDN input', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    const idInput = screen.getByLabelText(/nim.*nidn/i);
    expect(idInput).toBeInTheDocument();
    expect(idInput).toHaveAttribute('type', 'text');
  });

  it('renders the "Masuk" CTA button', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    const ctaButton = screen.getByRole('button', { name: /^masuk$/i });
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

  it('renders the "Hubungi Admin" registration link', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    const registerLink = screen.getByRole('link', { name: /hubungi admin/i });
    expect(registerLink).toBeInTheDocument();
  });

  it('renders the password input', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    const passwordInput = screen.getByLabelText(/^kata sandi$/i);
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput).toHaveAttribute('type', 'password');
  });
});
