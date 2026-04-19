import React from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import MyBooksPage from "./pages/MyBooksPage";
import AboutPage from "./pages/AboutPage";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/"          element={<HomePage />} />
        <Route path="/my-books"  element={<MyBooksPage />} />
        <Route path="/about"     element={<AboutPage />} />
      </Routes>
    </Layout>
  );
}