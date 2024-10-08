require("dotenv").config();
import { v4 as uuidv4 } from 'uuid'
import jwt from "jsonwebtoken";
import loginRegisterService from '../service/loginRegisterService'

const nonSecurePaths = ['/logout', '/login', '/register', '/verify-service-jwt'];

const createJWT = (payload) => {
    let key = process.env.JWT_SECRET;
    let token = null;
    try {
        token = jwt.sign(payload, key, {
            expiresIn: process.env.JWT_EXPIRES_IN
        });
    } catch (err) {
        console.log(err)
    }
    return token;
}

const verifyToken = (token) => {
    let key = process.env.JWT_SECRET;
    let decoded = null;

    try {
        decoded = jwt.verify(token, key);
    } catch (err) {

        // kiểm tra token còn hạn không
        if (err instanceof jwt.TokenExpiredError) {
            return "TokenExpiredError"
        }
        // console.log(err);
    }
    return decoded;
}

const extractToken = (req) => {
    if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
        return req.headers.authorization.split(' ')[1];
    }
    return null;
}

const checkUserJWT = async (req, res, next) => {
    
    if (nonSecurePaths.includes(req.path)) return next();

    let cookies = req.cookies;
    let tokenFromHeader = extractToken(req);

    if ((cookies && cookies.access_token) || tokenFromHeader) {
        let access_token = cookies && cookies.access_token ? cookies.access_token : tokenFromHeader;
        let decoded = verifyToken(access_token);
        
        if (decoded && decoded !== "TokenExpiredError") {
            decoded.access_token = access_token
            decoded.refresh_token = cookies.refresh_token
            req.user = decoded;
            next();

        } else if (decoded && decoded === "TokenExpiredError") {

            // handle refresh token
            if (cookies && cookies.refresh_token) {

                const data = await handleRefreshToken(cookies.refresh_token)
             
                const newAccessToken = data.newAccessToken
                const newRefreshToken = data.newRefreshToken

                if (newAccessToken && newRefreshToken) {

                    res.cookie('refresh_token', newRefreshToken, {
                        maxAge: +process.env.MAX_AGE_ACCESS_TOKEN,
                        httpOnly: true
                    })

                    res.cookie('access_token', newAccessToken, {
                        maxAge: +process.env.MAX_AGE_REFRESH_TOKEN,
                        httpOnly: true
                    })

                }

                return res.status(405).json({
                    EC: -1,
                    DT: '',
                    EM: 'Need to retry with new token!'
                })
            } else {
                return res.status(401).json({
                    EC: -1,
                    DT: '',
                    EM: 'Not authenticated the user'
                })
            }
        } else {
            return res.status(401).json({
                EC: -1,
                DT: '',
                EM: 'Not authenticated the user'
            })
        }
    } else {
        return res.status(401).json({
            EC: -1,
            DT: '',
            EM: 'Not authenticated the user'
        })
    }
}

const checkUserPermission = (req, res, next) => {
    if (nonSecurePaths.includes(req.path) || req.path === '/account') return next();

    if (req.user) {
        let email = req.user.email;
        let roles = req.user.groupWithRoles.Roles;
        let currentUrl = req.path;
        if (!roles || roles.length === 0) {
            return res.status(403).json({
                EC: -1,
                DT: '',
                EM: `you don't permission to access this resource...`
            })
        }

        let canAccess = roles.some(item => item.url === currentUrl || currentUrl.includes(item.url));
        if (canAccess === true) {
            next();
        } else {
            return res.status(403).json({
                EC: -1,
                DT: '',
                EM: `you don't permission to access this resource...`
            })
        }
    } else {
        return res.status(401).json({
            EC: -1,
            DT: '',
            EM: 'Not authenticated the user'
        })
    }
}

const checkServiceJWT = (req, res, next) => {
    let tokenFromHeader = extractToken(req);

    if (tokenFromHeader) {
        let access_token = tokenFromHeader;
        let decoded = verifyToken(access_token);
        if (decoded) {
            return res.status(200).json({
                EC: 0,
                DT: '',
                EM: 'verify the user'
            })

        } else {
            return res.status(401).json({
                EC: -1,
                DT: '',
                EM: 'Not authenticated the user'
            })
        }
    } else {
        return res.status(401).json({
            EC: -1,
            DT: '',
            EM: 'Not authenticated the user'
        })
    }
}

const handleRefreshToken = async (refreshToken) => {
    let newAccessToken = '', newRefreshToken = ''
    
    const user = await loginRegisterService.getUserByRefreshToken(refreshToken)

    if (user) {

        const payloadAccessToken = {
            email: user.DT.email,
            groupWithRoles: user.DT.groupWithRoles,
            username: user.DT.username,
        }

        newAccessToken = createJWT(payloadAccessToken);
        newRefreshToken = uuidv4()

        // update refresh token by email
        await loginRegisterService.updateUserRefreshToken(user.email, newRefreshToken)

    }

    return {
        newRefreshToken,
        newAccessToken
    }


}

module.exports = {
    checkServiceJWT,
    createJWT,
    verifyToken,
    checkUserJWT,
    checkUserPermission
}