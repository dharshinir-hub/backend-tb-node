// TokenService.js
class TokenService {
    constructor() {
      const savedToken = localStorage.getItem('token');
      if (savedToken) {
        this.token = savedToken;
      }
  
      const tenant = localStorage.getItem('tenant_id');
      if (tenant) {
        this.tenant_id = tenant;
      }
    }
  
    getEncodedToken = () => {
      const savedToken = localStorage.getItem('token');
      if (savedToken) {
        this.token = savedToken;
      }
      return this.token;
    };
  
    setToken = (token) => {
      this.token = token || null;
  
      if (token) {
        localStorage.setItem('token', token);
      } else {
        localStorage.removeItem('token');
      }
    };
  
    getTenantID = () => {
      const tenant = localStorage.getItem('tenant_id');
      if (tenant) {
        this.tenant_id = tenant;
      }
      return this.tenant_id;
    };
  
    isTokenValidated = () => {
      return this.token !== null;
    };
  }
  
  const tokenService = new TokenService();
  export default tokenService;