import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { supabase } from "./supabase";

export interface ApiResponse<T = unknown> {
  data: T;
  message?: string;
  success: boolean;
}

export interface ApiError {
  message: string;
  status: number;
  code?: string;
}

class HttpRequest {
  private axiosInstance: AxiosInstance;
  private baseURL: string;

  constructor(
    baseURL: string = import.meta.env.VITE_API_BASE_URL ||
      "http://localhost:3000/api"
  ) {
    this.baseURL = baseURL;
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor - Add auth token to every request
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        try {
          // Get current session from Supabase
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session?.access_token) {
            config.headers.Authorization = `Bearer ${session.access_token}`;
          }

          // Add user ID to headers if available
          if (session?.user?.id) {
            config.headers["X-User-ID"] = session.user.id;
          }

          console.log(
            `🚀 Admin API Request: ${config.method?.toUpperCase()} ${config.url}`
          );
          return config;
        } catch (error) {
          console.error("Error setting up request:", error);
          return config;
        }
      },
      (error) => {
        console.error("Request interceptor error:", error);
        return Promise.reject(error);
      }
    );

    // Response interceptor - Handle responses and errors
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        console.log(
          `✅ Admin API Response: ${response.status} ${response.config.url}`
        );
        return response;
      },
      async (error) => {
        const originalRequest = error.config;

        // Handle 401 Unauthorized - Token might be expired
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            // Try to refresh the session
            const {
              data: { session },
              error: refreshError,
            } = await supabase.auth.refreshSession();

            if (refreshError || !session) {
              // Refresh failed, redirect to login
              await supabase.auth.signOut();
              window.location.href = "/login";
              return Promise.reject(error);
            }

            // Retry the original request with new token
            originalRequest.headers.Authorization = `Bearer ${session.access_token}`;
            return this.axiosInstance(originalRequest);
          } catch (refreshError) {
            console.error("Token refresh failed:", refreshError);
            await supabase.auth.signOut();
            window.location.href = "/login";
            return Promise.reject(error);
          }
        }

        // Handle other errors
        const apiError: ApiError = {
          message:
            error.response?.data?.message ||
            error.message ||
            "An unexpected error occurred",
          status: error.response?.status || 500,
          code: error.response?.data?.code || error.code,
        };

        console.error(
          `❌ Admin API Error: ${apiError.status} ${error.config?.url}`,
          apiError
        );
        return Promise.reject(apiError);
      }
    );
  }

  // GET request
  async get<T = unknown>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.axiosInstance.get<ApiResponse<T>>(
        url,
        config
      );
      return response.data;
    } catch (error) {
      throw error as ApiError;
    }
  }

  // POST request
  async post<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.axiosInstance.post<ApiResponse<T>>(
        url,
        data,
        config
      );
      return response.data;
    } catch (error) {
      throw error as ApiError;
    }
  }

  // PUT request
  async put<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.axiosInstance.put<ApiResponse<T>>(
        url,
        data,
        config
      );
      return response.data;
    } catch (error) {
      throw error as ApiError;
    }
  }

  // PATCH request
  async patch<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.axiosInstance.patch<ApiResponse<T>>(
        url,
        data,
        config
      );
      return response.data;
    } catch (error) {
      throw error as ApiError;
    }
  }

  // DELETE request
  async delete<T = unknown>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.axiosInstance.delete<ApiResponse<T>>(
        url,
        config
      );
      return response.data;
    } catch (error) {
      throw error as ApiError;
    }
  }

  // Upload file
  async upload<T = unknown>(
    url: string,
    file: File,
    onUploadProgress?: (progress: number) => void
  ): Promise<ApiResponse<T>> {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await this.axiosInstance.post<ApiResponse<T>>(
        url,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          onUploadProgress: (progressEvent) => {
            if (onUploadProgress && progressEvent.total) {
              const progress = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              onUploadProgress(progress);
            }
          },
        }
      );

      return response.data;
    } catch (error) {
      throw error as ApiError;
    }
  }

  // Get current auth token
  async getAuthToken(): Promise<string | null> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      return session?.access_token || null;
    } catch (error) {
      console.error("Error getting auth token:", error);
      return null;
    }
  }

  // Set custom headers
  setHeader(key: string, value: string): void {
    this.axiosInstance.defaults.headers.common[key] = value;
  }

  // Remove custom headers
  removeHeader(key: string): void {
    delete this.axiosInstance.defaults.headers.common[key];
  }

  // Get base URL
  getBaseURL(): string {
    return this.baseURL;
  }

  // Update base URL
  setBaseURL(baseURL: string): void {
    this.baseURL = baseURL;
    this.axiosInstance.defaults.baseURL = baseURL;
  }
}

// Create and export a singleton instance
export const httpRequest = new HttpRequest();

// Export the class for creating custom instances if needed
export default HttpRequest;
