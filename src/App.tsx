/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { CatalogPage } from './pages/CatalogPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { PaymentPage } from './pages/PaymentPage';
import { CustomerPanelPage } from './pages/CustomerPanelPage';
import { AdminPanelPage } from './pages/AdminPanelPage';
import { BlogListPage, BlogDetailPage, FaqPage, StaticPage } from './pages/ContentPages';

function RouteSwitch() {
  const { currentPath } = useStore();
  const pathname = currentPath.split('?')[0] || '/';

  if (pathname === '/' || pathname === '') return <HomePage />;
  if (pathname === '/products' || pathname === '/search') return <CatalogPage />;
  if (pathname.startsWith('/category/')) {
    return <CatalogPage initialCategorySlug={pathname.replace('/category/', '')} />;
  }
  if (pathname.startsWith('/brand/')) {
    return <CatalogPage initialBrandSlug={pathname.replace('/brand/', '')} />;
  }
  if (pathname.startsWith('/product/')) {
    return <ProductDetailPage slug={pathname.replace('/product/', '')} />;
  }
  if (pathname === '/cart') return <CartPage />;
  if (pathname === '/checkout') return <CheckoutPage />;
  if (pathname.startsWith('/payment/')) {
    return <PaymentPage orderNumber={pathname.replace('/payment/', '')} />;
  }
  if (pathname.startsWith('/panel')) return <CustomerPanelPage />;
  if (pathname.startsWith('/admin')) return <AdminPanelPage />;
  if (pathname === '/blog') return <BlogListPage />;
  if (pathname.startsWith('/blog/')) {
    return <BlogDetailPage slug={pathname.replace('/blog/', '')} />;
  }
  if (pathname === '/faq') return <FaqPage />;
  if (pathname === '/about') return <StaticPage type="about" />;
  if (pathname === '/contact') return <StaticPage type="contact" />;
  if (pathname === '/shipping-policy') return <StaticPage type="shipping" />;
  if (pathname === '/return-policy') return <StaticPage type="return" />;
  if (pathname === '/privacy-policy') return <StaticPage type="privacy" />;
  if (pathname === '/terms') return <StaticPage type="terms" />;

  return <HomePage />;
}

export default function App() {
  return (
    <StoreProvider>
      <Layout>
        <RouteSwitch />
      </Layout>
    </StoreProvider>
  );
}
