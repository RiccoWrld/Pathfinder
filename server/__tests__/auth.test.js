const { authenticate, authorize } = require("../middleware/auth");

describe("authenticate middleware", () => {
  const createReq = (authHeader) => ({
    headers: { authorization: authHeader },
  });
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
  });

  it("returns 401 if no Authorization header", () => {
    authenticate(createReq(undefined), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Access denied. No token provided." });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 if header does not start with Bearer", () => {
    authenticate(createReq("Token abc"), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 if token is invalid", () => {
    authenticate(createReq("Bearer invalid-token"), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid or expired token." });
    expect(next).not.toHaveBeenCalled();
  });
});

describe("authorize middleware", () => {
  it("returns 403 if user role is not allowed", () => {
    const req = { user: { role: "student" } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    authorize("advisor")(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Insufficient permissions." });
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next if user role is allowed", () => {
    const req = { user: { role: "advisor" } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    authorize("advisor")(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 403 if req.user is not set", () => {
    const req = {};
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    authorize("advisor")(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
