import Link from "next/link";
import {
  ArrowRight,
  Play,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  Zap,
  X,
  Check,
  Package,
  BarChart3,
  Calculator,
  Smartphone,
  Store,
  MessageCircle,
  Settings,
  Phone,
  MapPin,
  Mail,
} from "lucide-react";
import styles from "./conoce-kivi.module.css";
import Reveal from "./Reveal";
import Image from "next/image";

export const metadata = {
  title: "Kivi - Sistema de Punto de venta",
  description:
    "Gestiona ventas, inventario, cortes de caja y reportes en tiempo real con Kivi.",
};

export default function ConoceKiviPage() {
  return (
    <>
      <nav className={styles.nav}>
        <Link href="/conoce-kivi" >
            <Image src="/logotipo.svg" alt="Kivi" width={120} height={10} />
        </Link>
        <div className={styles.navLinks}>
          <a href="#caracteristicas" className={styles.navLink}>
            Características
          </a>
          <a href="#precios" className={styles.navLink}>
            Precios
          </a>
          <a href="#como-funciona" className={styles.navLink}>
            ¿Cómo funciona?
          </a>
          <a href="#contacto" className={styles.navLink}>
            Contacto
          </a>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroGrid} aria-hidden="true" />
        <div className={styles.heroInner}>
          {/* Columna izquierda */}
          <div>
            <div className={styles.badge}>
              <span className={styles.badgeDot} />
              Hecho para negocios mexicanos
            </div>

            <h1 className={styles.title}>
              Controla tu negocio
              <span className={styles.titleAccent}>desde un solo lugar</span>
            </h1>

            <p className={styles.subtitle}>
              Gestiona <strong>ventas, inventario y cortes de caja</strong> en
              tiempo real con Kivi.
            </p>

            <div className={styles.ctaRow}>
              <a
                href="https://wa.me/5213325919284?text=Hola%2C%20me%20interesa%20conocer%20m%C3%A1s%20sobre%20Kivi%20POS"
                target="_blank"
                rel="noopener noreferrer"
                 className={styles.ctaPrimary}>
                Solicitar demo
                <ArrowRight size={18} />
              </a>
              <a href="#caracteristicas" className={styles.ctaSecondary}>
                <Play size={16} fill="currentColor" />
                Ver cómo funciona
              </a>
            </div>
          </div>

          {/* Columna derecha: mockup */}
          <div className={styles.mockupWrap}>
            <div className={styles.mockup}>
              <div className={styles.mockupHeader}>
            <Image src="/logotipo.svg" alt="Kivi" width={100} height={5} />
                <span className={styles.mockupPro}>PRO</span>
              </div>

              <div className={styles.mockupStats}>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>
                    <ShoppingCart size={14} />
                    Ventas Hoy
                  </div>
                  <div className={styles.statValue}>25</div>
                  <div className={styles.statDelta}>↑ 12% vs ayer</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>
                    <TrendingUp size={14} />
                    Ingresos
                  </div>
                  <div className={styles.statValue}>$14,580</div>
                  <div className={styles.statDelta}>↑ 8.3% vs ayer</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>
                    <TrendingUp size={14} />
                    Clientes
                  </div>
                  <div className={styles.statValue}>142</div>
                  <div className={styles.statDelta}>↑ 5% vs ayer</div>
                </div>
              </div>

              <div className={styles.mockupChartLabel}>
                Ventas por hora — Hoy
              </div>
              <div className={styles.mockupChart}>
                <svg viewBox="0 0 400 80" preserveAspectRatio="none">
                  <polyline
                    fill="none"
                    stroke="var(--color-primary)"
                    strokeWidth="3"
                    points="0,55 50,50 100,58 150,40 200,45 250,25 300,30 350,15 400,20"
                  />
                </svg>
              </div>

              <div className={styles.mockupTablesRow}>
                <div>
                  <div className={styles.mockupTableTitle}>VENTAS</div>
                  <div className={styles.mockupRow}>
                    <span>Coca Cola 600ml</span>
                    <span className={styles.mockupRowPrice}>$54</span>
                  </div>
                  <div className={styles.mockupRow}>
                    <span>Pan Bimbo</span>
                    <span className={styles.mockupRowPrice}>$32</span>
                  </div>
                </div>
                <div>
                  <div className={styles.mockupTableTitle}>ALERTAS</div>
                  <div className={styles.alertRow}>
                    <AlertTriangle size={14} />
                    Stock bajo: Coca Cola
                  </div>
                  <div className={styles.alertRow}>
                    <AlertTriangle size={14} />
                    Stock bajo: Agua 1L
                  </div>
                </div>
              </div>

              {/* Floating callouts */}
              <div className={`${styles.floatCard} ${styles.floatCardTop}`}>
                <div className={styles.floatCardLabel}>
                  <ShoppingCart size={14} />
                  Ventas Hoy
                </div>
                <div className={styles.floatCardValue}>+25</div>
                <div className={styles.floatCardDelta}>↑ 12% vs ayer</div>
              </div>

              <div
                className={`${styles.floatCard} ${styles.floatCardBottom}`}
              >
                <div className={styles.floatCardLabel}>
                  <AlertTriangle size={14} className={styles.floatCardWarning} />
                  Stock Bajo
                </div>
                <div className={styles.floatCardValue}>2 productos</div>
                <div
                  className={`${styles.floatCardDelta} ${styles.floatCardWarning}`}
                >
                  Requiere atención
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.problema} id="problema">
        <Reveal className={styles.sectionHeader}>
          <span className={styles.sectionBadge}>
            El problema vs la solución
          </span>
          <h2 className={styles.sectionTitle}>
            ¿Tu negocio sufre de esto?
          </h2>
        </Reveal>

        <div className={styles.compareGrid}>
          <Reveal>
            <div className={`${styles.compareCard} ${styles.compareCardBad}`}>
              <div className={styles.compareHeader}>
                <span className={`${styles.compareIcon} ${styles.compareIconBad}`}>
                  <X size={18} />
                </span>
                <span className={`${styles.compareTitle} ${styles.compareTitleBad}`}>
                  Sin Kivi
                </span>
              </div>
              <ul className={styles.compareList}>
                <li className={styles.compareItem}>
                  <span className={`${styles.compareIcon} ${styles.compareIconBad}`}>
                    <X size={12} />
                  </span>
                  Inventarios desorganizados y sin control
                </li>
                <li className={styles.compareItem}>
                  <span className={`${styles.compareIcon} ${styles.compareIconBad}`}>
                    <X size={12} />
                  </span>
                  Pérdida de ventas por procesos lentos
                </li>
                <li className={styles.compareItem}>
                  <span className={`${styles.compareIcon} ${styles.compareIconBad}`}>
                    <X size={12} />
                  </span>
                  Información dispersa en papeles y excel
                </li>
                <li className={styles.compareItem}>
                  <span className={`${styles.compareIcon} ${styles.compareIconBad}`}>
                    <X size={12} />
                  </span>
                  Sin reportes para tomar decisiones
                </li>
              </ul>
            </div>
          </Reveal>

          <span className={styles.compareArrow} aria-hidden="true">
            <ArrowRight size={24} />
          </span>

          <Reveal delay={150}>
            <div className={`${styles.compareCard} ${styles.compareCardGood}`}>
              <div className={styles.compareHeader}>
                <span className={`${styles.compareIcon} ${styles.compareIconGood}`}>
                  <Check size={18} />
                </span>
                <span className={`${styles.compareTitle} ${styles.compareTitleGood}`}>
                  Con Kivi
                </span>
              </div>
              <ul className={styles.compareList}>
                <li className={styles.compareItem}>
                  <span className={`${styles.compareIcon} ${styles.compareIconGood}`}>
                    <Check size={12} />
                  </span>
                  Todo centralizado en un solo sistema
                </li>
                <li className={styles.compareItem}>
                  <span className={`${styles.compareIcon} ${styles.compareIconGood}`}>
                    <Check size={12} />
                  </span>
                  Inventario actualizado en tiempo real
                </li> 
                <li className={styles.compareItem}>
                  <span className={`${styles.compareIcon} ${styles.compareIconGood}`}>
                    <Check size={12} />
                  </span>
                  Reportes listos para tomar decisiones
                </li>
                <li className={styles.compareItem}>
                  <span className={`${styles.compareIcon} ${styles.compareIconGood}`}>
                    <Check size={12} />
                  </span>
                  Más control sobre ventas e inventario
                </li>
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      <section className={styles.caracteristicas} id="caracteristicas">
        <Reveal className={styles.sectionHeader}>
          <span className={styles.sectionBadge}>Características</span>
          <h2 className={styles.sectionTitle}>
            Todo lo que necesitas en un solo sistema
          </h2>
          <p className={styles.subtitle} style={{ margin: "var(--space-4) auto 0", textAlign: "center" }}>
            Herramientas pensadas para que tu negocio funcione más rápido y
            con mayor control.
          </p>
        </Reveal>

        <div className={styles.featuresGrid}>
          {[
            {
              icon: <ShoppingCart size={22} />,
              title: "Ventas",
              description:
                "Selecciona productos, cobra y genera el ticket en segundos.",
            },
            {
              icon: <Package size={22} />,
              title: "Inventario",
              description:
                "Control de stock en tiempo real, con alertas cuando un producto está por agotarse.",
            },
            {
              icon: <BarChart3 size={22} />,
              title: "Reportes",
              description:
                "Visualiza ventas, ingresos y tendencias de tu negocio para tomar mejores decisiones.",
            },
            {
              icon: <Calculator size={22} />,
              title: "Cortes de Caja",
              description:
                "Cierra el día con precisión: registra el efectivo y compara contra lo vendido.",
            },
            {
              icon: <Store size={22} />,
              title: "Multi-Negocio",
              description:
                "Cada negocio tiene su propio espacio, productos e inventario.",
            },
            {
              icon: <Smartphone size={22} />,
              title: "Multi-Dispositivo",
              description:
                "Trabaja desde cualquier dispositivo. Instálalo como app, siempre disponible.",
            },
          ].map((feature, i) => (
            <Reveal key={feature.title} delay={i * 80}>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon}>{feature.icon}</div>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureDescription}>
                  {feature.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className={styles.comoFunciona} id="como-funciona">
        <Reveal className={styles.sectionHeader}>
          <a href="#como-funciona" className={styles.sectionBadge}>
            Cómo funciona
          </a>
          <h2 className={styles.sectionTitle}>Empieza en 4 pasos simples</h2>
        </Reveal>

        <div className={styles.stepsGrid}>
          {[
            {
              icon: <MessageCircle size={28} />,
              label: "Paso 01",
              title: "Solicita una demo",
              description:
                "Cuéntanos sobre tu negocio y te mostramos cómo funciona Kivi para tu caso.",
              color: "var(--color-primary)",
            },
            {
              icon: <Settings size={28} />,
              label: "Paso 02",
              title: "Configuramos tu negocio",
              description:
                "Damos de alta tu catálogo, precios e inventario inicial junto contigo.",
              color: "var(--color-primary-900)",
            },
            {
              icon: <ShoppingCart size={28} />,
              label: "Paso 03",
              title: "Comienza a vender",
              description:
                "Procesa ventas desde el primer día, desde computadora, tablet o celular.",
              color: "var(--color-success)",
            },
            {
              icon: <BarChart3 size={28} />,
              label: "Paso 04",
              title: "Revisa tus reportes",
              description:
                "Consulta ventas, inventario y cortes de caja para tomar mejores decisiones.",
              color: "var(--color-warning)",
            },
          ].map((step, i) => (
            <Reveal key={step.title} delay={i * 100}>
              <div className={styles.step}>
                <div
                  className={styles.stepCircleWrap}
                  style={{ "--stepColor": step.color } as React.CSSProperties}
                >
                  <div className={styles.stepCircle}>{step.icon}</div>
                  <span className={styles.stepNumber}>{i + 1}</span>
                  {i < 3 && <span className={styles.stepConnector} />}
                </div>
                <span className={styles.stepLabel}>{step.label}</span>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepDescription}>{step.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className={styles.precios} id="precios">
        <Reveal className={styles.sectionHeader}>
          <span className={styles.sectionBadge}>Precios</span>
          <h2 className={styles.sectionTitle}>Un plan simple y transparente</h2>
        </Reveal>

        <Reveal className={styles.pricingCardWrap}>
          <div className={styles.pricingCard}>
            <span className={styles.pricingBadge}>
              <Zap size={14} fill="currentColor" />
              Plan único
            </span>
            <h3 className={styles.pricingName}>Básico</h3>
            <p className={styles.pricingDescription}>
              Todo lo que tu negocio necesita.
            </p>
            <div className={styles.pricingPrice}>
              $500 <span>MXN / mes</span>
            </div>
            <p className={styles.pricingNote}>
              Primeros negocios: 15 días de prueba sin costo
            </p>

            <div className={styles.pricingFeatures}>
              {[
                "Punto de venta sin límite de ventas",
                "Control de inventario en tiempo real",
                "Cortes de caja",
                "Reportes de ventas e ingresos",
                "Acceso multi-dispositivo (PWA)",
                "Soporte directo y personalizado",
              ].map((feature) => (
                <div key={feature} className={styles.pricingFeature}>
                  <Check size={16} />
                  {feature}
                </div>
              ))}
            </div>

            <a 
                href="https://wa.me/5213325919284?text=Hola%2C%20me%20interesa%20conocer%20m%C3%A1s%20sobre%20Kivi%20POS"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.ctaPrimary} style={{ width: "100%", justifyContent: "center" }}>
              Solicitar demo
              <ArrowRight size={18} />
            </a>

            <p className={styles.pricingFooter}>
              Sin contratos forzosos. Cancela cuando quieras.
            </p>
          </div>
        </Reveal>
      </section>

      <section className={styles.ctaSection} id="contacto">
        <Reveal className={styles.ctaBox}>
          <span className={styles.badge} style={{ animation: "none", opacity: 1 }}>
            <span className={styles.badgeDot} />
            Cupo limitado para piloto gratuito
          </span>
          <h2 className={styles.ctaTitle}>
            Lleva tu negocio al
            <br />
            <span className={styles.titleAccent} style={{ display: "inline" }}>
              siguiente nivel
            </span>{" "}
            con Kivi
          </h2>
          <p className={styles.ctaSubtitle}>
            Cuéntanos sobre tu negocio y te mostramos cómo Kivi puede
            ayudarte a controlar tus ventas e inventario desde un solo lugar.
          </p>
          <div className={styles.ctaButtons}>
            <a
              href="https://wa.me/5213325919284?text=Hola%2C%20me%20interesa%20conocer%20m%C3%A1s%20sobre%20Kivi%20POS"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.ctaPrimary}
            >
              Solicitar demo por WhatsApp
              <ArrowRight size={18} />
            </a>
          </div>
          <div className={styles.ctaChecks}>
            <span>
              <Check size={16} />
              Sin contrato forzoso
            </span>
            <span>
              <Check size={16} />
              Cancela cuando quieras
            </span>
            <span>
              <Check size={16} />
              Configuración acompañada
            </span>
          </div>
        </Reveal>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerTop}>
            <div className={styles.footerBrand}>
                <Link href="/conoce-kivi" >
                    <Image src="/logotipo.svg" alt="Kivi" width={120} height={10} />
                </Link>
              <p className={styles.footerDescription}>
                Sistema de punto de venta para pequeños y medianos negocios
                mexicanos. Ventas, inventario y reportes desde un solo lugar.
              </p>
              <div className={styles.footerContactItem}>
                <Mail size={16} />
                contacto.kivi@gmail.com
              </div>
              <div className={styles.footerContactItem}>
                <Phone size={16} />
                +52 1 33 2591 9284
              </div>
              <div className={styles.footerContactItem}>
                <MapPin size={16} />
                México
              </div>
              <div className={styles.footerSocials}>
                <a
                  href="https://www.instagram.com/kivi.mx"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.footerSocialIcon}
                  aria-label="Instagram"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                  </svg>
                </a>
                <a
                  href="https://www.facebook.com/kivi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.footerSocialIcon}
                  aria-label="Facebook"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22 12a10 10 0 1 0-11.5 9.95v-7.04H7.9V12h2.6V9.8c0-2.57 1.53-3.99 3.87-3.99 1.12 0 2.3.2 2.3.2v2.53h-1.3c-1.27 0-1.67.79-1.67 1.6V12h2.84l-.45 2.91h-2.39v7.04A10 10 0 0 0 22 12z" />
                  </svg>
                </a>
              </div>
            </div>

            <div className={styles.footerLinks}>
              <div className={styles.footerLinkGroup}>
                <span className={styles.footerLinkTitle}>Producto</span>
                <a href="#caracteristicas" className={styles.footerLink}>
                  Características
                </a>
                <a href="#precios" className={styles.footerLink}>
                  Precios
                </a>
                <a href="#como-funciona" className={styles.footerLink}>
                  Cómo funciona
                </a>
              </div>
              <div className={styles.footerLinkGroup}>
                <span className={styles.footerLinkTitle}>Contacto</span>
                <a
                  href="https://wa.me/5213325919284?text=Hola%2C%20me%20interesa%20conocer%20m%C3%A1s%20sobre%20Kivi%20POS"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.footerLink}
                >
                  WhatsApp
                </a>
              </div>
            </div>
          </div>

          <div className={styles.footerBottom}>
            <span>© {new Date().getFullYear()} Kivi. Todos los derechos reservados.</span>
          </div>
        </div>
      </footer>
    </>
  );
}   