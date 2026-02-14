"use client";

import { useNavigate } from "react-router-dom";
import React, { useState } from "react";
import "../style/LoginForm.css";


interface LoginScreenProps { //TODO : Añadir funcionalidades de onLogin, onSignUp y onForgotPassword
  onLogin?: (username: string, password: string) => void;
  onSignUp?: () => void;
  //onForgotPassword?: () => void; //Lo elimino por ahora, no se si se podrá implementar. 
}

export default function LoginScreen({onLogin, onSignUp, /*onForgotPassword,*/} : LoginScreenProps) 
{
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();


  const handleSubmit = (e: React.FormEvent) => {//Al enviar el formulario
    e.preventDefault(); //Para no recargar la página al hacer submit

    //TODO -> validación campos
    onLogin?.(username, password); //Funcionalidad del login, se llama a la función onLogin pasada con el username y password actuales
   
    navigate("/game");
  };


return (
    <div className="login-backdrop">

    {/*Contenedor formulario */}
      <div className="login-card">

        {/* Logo de YOVI (Por ahora es texto, podría ser un svg)*/}
        <div className="login-logo">
          <div className="login-logo-icon" aria-hidden="true">
            <span>Y</span>
          </div>
          <span className="login-logo-text">YOVI</span>
        </div>

        {/*Formulario*/}
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-input-wrapper">
            <input
              type="text"
              className="login-input"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              aria-label="Username"
            />
          </div>

          <div className="login-input-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              className="login-input"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              aria-label="Password"
            />
            <button
              type="button"
              className="login-eye-btn"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>

          <button type="submit" className="login-btn">
            Login
          </button>
        </form>

        {/* <button type="button" className="login-forgot-btn" onClick={onForgotPassword}>
          Forgot Password?
        </button> */}
      </div>

      <button type="button" className="login-signup-btn" onClick={onSignUp}>
        Sign Up
      </button>
    </div>
  );
}
