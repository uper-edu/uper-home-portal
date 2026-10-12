import React from 'react';
import { Helmet } from 'react-helmet-async';

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface FAQItem {
  question: string;
  answer: string;
}

interface CourseItem {
  name: string;
  description: string;
  provider?: string;
}

interface SEOProps {
  title: string;
  description: string;
  image?: string;
  type?: string;
  keywords?: string;
  canonicalUrl?: string;
  lastUpdated?: string;
  breadcrumbs?: BreadcrumbItem[];
  faqs?: FAQItem[];
  courseData?: CourseItem;
  schemaData?: object;
}

export function SEO({ 
  title, 
  description, 
  image = 'https://uperedu.com/logo.png', 
  type = 'website', 
  keywords, 
  canonicalUrl,
  lastUpdated = '2026-08-15',
  breadcrumbs,
  faqs,
  courseData,
  schemaData 
}: SEOProps) {
  const fullTitle = title.toLowerCase().includes('uper') ? title : `${title} | UPER Education`;
  
  // High-intent default keywords targeting Study in China, HSK, and CSCA prep in Indonesia
  const defaultKeywords = "UPER, UPER Education, kuliah di China, beasiswa China, beasiswa kuliah di Tiongkok, study tour ke China, kursus HSK Jakarta PIK, persiapan CSCA, study in China agent Jakarta, Chinese Government Scholarship CSC, CSCA, China Scholastic Competency Assessment, CSCA Indonesia, pendaftaran CSCA, ujian CSCA 2026, beasiswa China S1, beasiswa S2 China, syarat beasiswa China, beasiswa beasiswa China, kursus HSK, kelas persiapan HSK, les mandarin HSK, International Academic Competitions, International Student Olympiads, beasiswa s1 s2 s3 china, agen persiapan kuliah china";
  const finalKeywords = keywords ? `${keywords}, ${defaultKeywords}` : defaultKeywords;

  // AI & Search Engine GEO-friendly JSON-LD Structured Data
  const graph: any[] = [
    {
      "@type": "EducationalOrganization",
      "@id": "https://uperedu.com/#organization",
      "name": "UPER (University Partnership Education)",
      "legalName": "PT UPER EDUCATION TECHNOLOGY",
      "url": "https://uperedu.com",
      "logo": {
        "@type": "ImageObject",
        "url": "https://uperedu.com/logo.png"
      },
      "sameAs": [
        "https://www.instagram.com/uper.education",
        "https://wa.me/6281116612062"
      ],
      "contactPoint": [
        {
          "@type": "ContactPoint",
          "telephone": "+62-811-1661-2062",
          "contactType": "admissions",
          "areaServed": ["ID", "Global"],
          "availableLanguage": ["Indonesian", "English", "Chinese"]
        },
        {
          "@type": "ContactPoint",
          "telephone": "+86-18612142789",
          "contactType": "China Liaison & Partnerships",
          "areaServed": ["CN", "ID"],
          "availableLanguage": ["Chinese", "English"]
        }
      ],
      "department": [
        {
          "@id": "https://uperedu.com/#localbusiness-jakarta"
        },
        {
          "@id": "https://uperedu.com/#localbusiness-hangzhou"
        }
      ],
      "description": "Lembaga konsultan pendidikan dan pathway resmi kuliah di China untuk siswa Indonesia. Bimbingan beasiswa CSC penuh, ujian CSCA, kursus HSK 3.0 standar BLCU."
    },
    {
      "@type": "LocalBusiness",
      "@id": "https://uperedu.com/#localbusiness-jakarta",
      "name": "UPER Head Office Jakarta",
      "parentOrganization": {
        "@id": "https://uperedu.com/#organization"
      },
      "image": "https://uperedu.com/logo.png",
      "telephone": "+62 811-1661-2062",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "Ruko Golf Island, JL. Pantai Indah Kapuk No. 100 Blok E",
        "addressLocality": "Jakarta Utara",
        "addressRegion": "DKI Jakarta",
        "postalCode": "14470",
        "addressCountry": "ID"
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": -6.1219,
        "longitude": 106.7410
      },
      "url": "https://uperedu.com",
      "priceRange": "$$",
      "openingHoursSpecification": {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday"
        ],
        "opens": "09:00",
        "closes": "18:00"
      }
    },
    {
      "@type": "LocalBusiness",
      "@id": "https://uperedu.com/#localbusiness-hangzhou",
      "name": "UPER China Office (Hangzhou)",
      "alternateName": "UPER 中国办公室 (杭州)",
      "parentOrganization": {
        "@id": "https://uperedu.com/#organization"
      },
      "image": "https://uperedu.com/logo.png",
      "telephone": "+86 18612142789",
      "employee": {
        "@type": "Person",
        "name": "Wang Lisong",
        "jobTitle": "China Representative"
      },
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "Headquarters Economy Park for Alumni Corporation of Zhejiang University",
        "addressLocality": "Hangzhou",
        "addressRegion": "Zhejiang",
        "addressCountry": "CN"
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": 30.2642,
        "longitude": 120.1065
      },
      "url": "https://uperedu.com/contact",
      "priceRange": "$$",
      "openingHoursSpecification": {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday"
        ],
        "opens": "09:00",
        "closes": "18:00"
      }
    }
  ];

  // 1. BreadcrumbList Schema
  if (breadcrumbs && breadcrumbs.length > 0) {
    graph.push({
      "@type": "BreadcrumbList",
      "itemListElement": breadcrumbs.map((item, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "name": item.name,
        "item": item.url
      }))
    });
  }

  // 2. FAQPage Schema for Rich Snippets (High CTR on Google SERP)
  if (faqs && faqs.length > 0) {
    graph.push({
      "@type": "FAQPage",
      "mainEntity": faqs.map(faq => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer
        }
      }))
    });
  }

  // 3. Course Schema for Training & Exam Prep Programs
  if (courseData) {
    graph.push({
      "@type": "Course",
      "name": courseData.name,
      "description": courseData.description,
      "provider": {
        "@type": "Organization",
        "name": courseData.provider || "PT UPER EDUCATION TECHNOLOGY",
        "sameAs": "https://uperedu.com"
      }
    });
  }

  if (schemaData) {
    graph.push(schemaData);
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": graph
  };

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={finalKeywords} />
      <meta name="dateModified" content={lastUpdated} />
      
      {/* Canonical URL */}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      
      {/* Open Graph / Facebook */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      {image && <meta property="og:image" content={image} />}
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      {image && <meta name="twitter:image" content={image} />}

      {/* Advanced GEO Tags & Local SEO for PIK Head Office, North Jakarta */}
      <meta name="geo.region" content="ID-JK" />
      <meta name="geo.placename" content="Jakarta Utara" />
      <meta name="geo.position" content="-6.1219;106.7410" />
      <meta name="ICBM" content="-6.1219, 106.7410" />
      <meta name="DC.title" content="UPER - University Partnership Education" />

      {/* Schema.org Structured Data for AI-Powered Search Engines (GEO/SEO) */}
      <script type="application/ld+json">
        {JSON.stringify(jsonLd)}
      </script>
    </Helmet>
  );
}
