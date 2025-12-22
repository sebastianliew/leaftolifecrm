import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
    darkMode: ["class"],
    content: [
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/utils/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/hooks/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/providers/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/**/*.{js,ts,jsx,tsx,mdx}",
        "./*.{js,ts,jsx,tsx,mdx}"
    ],
  theme: {
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      xxl: { min: '1400px' },
      '2xxl': { min: '1600px' },
      large: { min: '2100px' },
    },
    boxShadow: {
      header: '0 2px 4px rgba(0,0,0,0.12)',
      mobile: '0 0px 2px rgba(0,0,0,0.12)',
      counter: '0 2px 4px rgba(0,32,25,0.06)',
      cart: '0 3px 6px rgba(0,0,0,0.12)',
      navigation: '0 3px 6px rgba(0, 0, 0, 0.16)',
      footer: '3px 0 6px rgba(0,0,0,0.12)',
      float: '0 0 6px rgba(0,0,0,0.12)',
      floatBig: '0 0 10px rgba(0,0,0,0.16)',
      floatingUp: '0 5px 10px rgba(0,0,0,0.16)',
      upside: '0 9px 7px -8px rgba(0,0,0,0.6)',
      imgFloat: '0 10px 10px rgba(0,0,0,0.16)',
    },
    fontFamily: {
      open: ['Open Sans', 'sans-serif'],
    },
    fontSize: {
      '11px': '11px',
      '12px': '12px',
      '13px': '13px',
      '14px': '14px',
      '16px': '16px',
      '18px': '18px',
      '21px': '21px',
      '24px': '24px',
      '30px': '30px',
      '36px': '36px',
    },
  	extend: {
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			},
          // Medsy color scheme
          'medsy-green': '#209F85',
          'medsy-green-hover': '#1E957C',
          'medsy-green-light': 'rgba(32,159,133, 0.3)',
          error: '#ff5b60',
          'gray-f7': '#f7f7f7',
          'gray-3a': '#3a3a3a',
          'gray-light': '#fafafa',
          'light-yellow': '#feeec8',
          'light-blue': '#ceeffe',
          'light-green': '#d4f8c4',
          'light-purple': '#d8dafe',
          overlay: 'rgba(0,0,0,0.7)',
          dark: '#212121',
          gray: {
            100: '#f9f9f9',
            200: '#f3f3f3',
            300: '#e6e6e6',
            400: '#D5D5D5',
            500: '#999999',
            600: '#757575',
            700: '#575757',
            800: '#424242',
            900: '#212121',
          },
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)',
        default: '6px',
        '9px': '9px',
        '10px': '10px',
        '20px': '20px',
        '30px': '30px',
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		},
      lineHeight: {
        11: '2.75rem',
        12: '3rem',
      },
      width: {
        'main-content': 'calc(100% - 360px)',
        sidebar: '360px',
      },
      maxWidth: {
        half: '50%',
        '720px': '720px',
        '820px': '820px',
      },
      maxHeight: {
        '650px': '650px',
      },
      minWidth: {
        8: '2rem',
      },
      height: {
        drawer: 'calc(100vh - 90px)',
      },
      spacing: {
        9: '2.25rem',
        11: '2.75rem',
        14: '3.5rem',
        '3px': '3px',
        '5px': '5px',
        '10px': '10px',
        '15px': '15px',
        '-15px': '-15px',
        '18px': '18px',
        '20px': '20px',
        '-20px': '-20px',
        '30px': '30px',
        '35px': '35px',
        '40px': '40px',
        '45px': '45px',
        '50px': '50px',
        '60px': '60px',
        '70px': '70px',
        '80px': '80px',
        '90px': '90px',
        '95px': '95px',
        '100px': '100px',
        '105px': '105px',
        '110px': '110px',
        '120px': '120px',
        '130px': '130px',
        '146px': '146px',
        '200px': '200px',
        '235px': '235px',
        '320px': '320px',
        '360px': '360px',
        '480px': '480px',
        '580px': '580px',
        '650px': '650px',
        '1440px': '1440px',
      },
      inset: {
        8: '2rem',
        9: '2.25rem',
        14: '3.5rem',
        half: '50%',
        '10px': '10px',
        '15px': '15px',
        '20px': '20px',
        '25px': '25px',
        '30px': '30px',
        '40px': '40px',
        '60px': '60px',
        '62px': '62px',
        '90px': '90px',
      },
      borderWidth: {
        '3px': '3px',
      },
      transitionDuration: {
        350: '350ms',
      },
  	}
  },
  variants: {
    textColor: ['responsive', 'hover', 'focus', 'group-hover'],
    borderWidth: ['responsive', 'last', 'hover', 'focus'],
    padding: ['responsive, odd, even'],
    width: ['responsive', 'hover', 'focus'],
  },
  plugins: [tailwindcssAnimate],
};
export default config;
