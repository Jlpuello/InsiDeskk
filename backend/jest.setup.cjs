// Los tests hacen muchos logins seguidos contra el mismo Redis de dev — sin
// esto el limitador de fuerza bruta (10 por ventana) los frenaría con 429.
process.env.AUTH_RATE_LIMIT_MAX = '1000';
