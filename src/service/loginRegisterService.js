require('dotenv').config();
import db from '../models/index';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import { getGroupWithRoles } from './JWTService';
import { v4 as uuidv4 } from 'uuid'

const salt = bcrypt.genSaltSync(10);

const hashUserPassword = (userPassword) => {
    let hashPassword = bcrypt.hashSync(userPassword, salt);
    return hashPassword;
}

const checkEmailExist = async (userEmail) => {
    let user = await db.User.findOne({
        where: { email: userEmail }
    })

    if (user) {
        return true;
    }
    return false;
}

const checkPhoneExist = async (userPhone) => {
    let user = await db.User.findOne({
        where: { phone: userPhone }
    })

    if (user) {
        return true;
    }
    return false;
}

const registerNewUser = async (rawUserData) => {
    try {
        //check email/phonenumber are exist
        let isEmailExist = await checkEmailExist(rawUserData.email);
        if (isEmailExist === true) {
            return {
                EM: 'The email is already exist',
                EC: 1
            }
        }
        let isPhoneExist = await checkPhoneExist(rawUserData.phone);
        if (isPhoneExist === true) {
            return {
                EM: 'The phone number is already exist',
                EC: 1
            }
        }
        //hash user password
        let hashPassword = hashUserPassword(rawUserData.password);

        //create new user
        await db.User.create({
            email: rawUserData.email,
            username: rawUserData.username,
            password: hashPassword,
            phone: rawUserData.phone,
            groupId: 4
        })

        return {
            EM: 'A user is created successfully!',
            EC: '0'
        }

    } catch (e) {
        console.log(e)
        return {
            EM: 'Somthing wrongs in service...',
            EC: -2
        }
    }
}

const checkPassword = (inputPassword, hashPassword) => {
    return bcrypt.compareSync(inputPassword, hashPassword); // true or false
}

const handleUserLogin = async (rawData) => {
    try {

        let user = await db.User.findOne({
            where: {
                [Op.or]: [
                    { email: rawData.valueLogin },
                    { phone: rawData.valueLogin }
                ]
            }
        })

        if (user) {
            let isCorrectPassword = checkPassword(rawData.password, user.password);
            if (isCorrectPassword) {
                let groupWithRoles = await getGroupWithRoles(user);

                return {
                    EM: 'ok!',
                    EC: 0,
                    DT: {
                        code: uuidv4(),
                        email: user.email,
                        groupWithRoles,
                        username: user.username
                    }
                }
            } else {
                return {
                    EM: 'Mật khẩu không khớp!',
                    EC: 1,
                    DT: ''
                }
            }
        }

        return {
            EM: 'Email/Số điện thoại hoặc mật khẩu của bạn không chính xác!',
            EC: 1,
            DT: ''
        }


    } catch (error) {
        console.log(error)
        return {
            EM: 'Somthing wrongs in service...',
            EC: -2
        }
    }
}

const updateUserRefreshToken = async (email, token) => {
    try {
        await db.User.update(
            { refreshToken: token },
            { where: { email: email } }
        )
    } catch (error) {
        console.log(error)
        return {
            EM: 'Somthing wrongs in service...',
            EC: -2
        }
    }
}

const upsertUserSocialMedia = async (typeAcc, dataRaw) => {
    try {

        let user = null

        user = await db.User.findOne({
            where: { email: dataRaw.email, type: typeAcc },
            raw: true
        })

        if (!user) {
            user = await db.User.create({
                email: dataRaw.email,
                username: dataRaw.username,
                type: typeAcc
            })

            user = user.get({ plain: true })
        }

        return user

    } catch (error) {
        console.log(error)
    }
}

const getUserByRefreshToken = async (token) => {
    try {
        
        let user = await db.User.findOne({
            where: { refreshToken: token }
        })

        if (user) {
            let groupWithRoles = await getGroupWithRoles(user);

            return {
                EM: 'ok!',
                EC: 0,
                DT: {
                    email: user.email,
                    groupWithRoles: groupWithRoles,
                    username: user.username,
                }
            }
        }

        return null
    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    registerNewUser,
    handleUserLogin,
    hashUserPassword,
    checkEmailExist,
    checkPhoneExist,
    updateUserRefreshToken,
    upsertUserSocialMedia,
    getUserByRefreshToken
}